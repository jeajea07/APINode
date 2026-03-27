import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE ?? "http://localhost:3000";

interface TimelineEntry {
  timestamp: string;
  processed: number;
  failed: number;
  docsPerSec: number;
}

interface BenchmarkReport {
  totalTimeMs: number;
  docsPerSecond: number;
  peakMemoryMB: number;
  failedCount: number;
  successCount: number;
  timeline: TimelineEntry[];
}

interface BatchStatusResponse {
  batchId: string;
  status: string;
  documents: Array<{
    documentId: string;
    status: "pending" | "processing" | "completed" | "failed";
    generationTimeMs: number | null;
  }>;
}

async function runBenchmark(): Promise<void> {
  console.log("=== BENCHMARK — 1000 documents ===\n");

  const ids = Array.from({ length: 1000 }, (_, i) => `bench_user_${i}`);
  const startTime = Date.now();

  // Étape 1 — Créer le batch
  const postRes = await fetch(`${API_BASE}/api/documents/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ids)
  });
  if (!postRes.ok) throw new Error(`POST failed: ${postRes.status}`);
  const postBody = (await postRes.json()) as { batchId: string };
  const batchId = postBody.batchId;
  console.log(`Batch créé : ${batchId}`);

  // Étape 2 — Polling
  const timeline: TimelineEntry[] = [];
  let status = "pending";
  let lastCompleted = 0;
  let lastFailed = 0;
  let lastProcessed = 0;
  let stagnantPolls = 0;
  const pollIntervalMs = 2000;
  const maxNoProgressPolls = Number(process.env.BENCHMARK_MAX_NO_PROGRESS_POLLS ?? 15);
  const maxDurationMs = Number(process.env.BENCHMARK_TIMEOUT_MS ?? 120000);

  while (status !== "completed" && status !== "failed") {
    await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));

    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > maxDurationMs) {
      throw new Error(
        `Benchmark timeout after ${maxDurationMs}ms. ` +
          `Progress: ${lastCompleted + lastFailed}/${ids.length}. ` +
          `Is the worker running?`
      );
    }

    const getRes = await fetch(`${API_BASE}/api/documents/batch/${batchId}`);
    const batch = (await getRes.json()) as BatchStatusResponse;

    status = batch.status;
    const documents = batch.documents ?? [];
    const totalDocuments = documents.length;
    const completed = documents.filter((d) => d.status === "completed").length;
    const failed = documents.filter((d) => d.status === "failed").length;
    const processed = completed + failed;
    const elapsedSec = (Date.now() - startTime) / 1000;
    const docsPerSec = Math.round(processed / Math.max(1, elapsedSec));

    timeline.push({
      timestamp: new Date().toISOString(),
      processed,
      failed,
      docsPerSec
    });

    console.log(
      `[${Math.round(elapsedSec)}s] status=${status} ` +
        `processed=${processed}/${totalDocuments} ` +
        `failed=${failed} ` +
        `docs/s=${docsPerSec}`
    );

    lastCompleted = completed;
    lastFailed = failed;
    if (processed === lastProcessed) {
      stagnantPolls += 1;
    } else {
      stagnantPolls = 0;
      lastProcessed = processed;
    }

    if (stagnantPolls >= maxNoProgressPolls) {
      throw new Error(
        `No progress for ${stagnantPolls * pollIntervalMs}ms. ` +
          `Progress: ${processed}/${totalDocuments}. ` +
          `Is the worker running?`
      );
    }
    if ((status === "completed" || status === "failed") && processed < totalDocuments) {
      status = "processing";
    }
  }

  // Étape 3 — Rapport
  const totalTimeMs = Date.now() - startTime;
  if (timeline.length === 0) throw new Error("No timeline entries collected");
  const totalProcessed = lastCompleted + lastFailed;

  const report: BenchmarkReport = {
    totalTimeMs,
    docsPerSecond: Math.round(totalProcessed / (totalTimeMs / 1000)),
    peakMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    failedCount: lastFailed,
    successCount: lastCompleted,
    timeline
  };

  const outDir = path.resolve(__dirname);
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(outDir, "report.txt"),
    [
      "=== BENCHMARK REPORT ===",
      `Date           : ${new Date().toISOString()}`,
      `Durée totale   : ${totalTimeMs}ms`,
      `Débit moyen    : ${report.docsPerSecond} docs/s`,
      `Succès         : ${report.successCount}/1000`,
      `Échecs         : ${report.failedCount}/1000`,
      `Mémoire peak   : ${report.peakMemoryMB} MB`
    ].join("\n")
  );

  console.log("\n=== RÉSULTAT ===");
  console.log(`Durée totale  : ${totalTimeMs}ms`);
  console.log(`Débit moyen   : ${report.docsPerSecond} docs/s`);
  console.log(`Succès/Échecs : ${report.successCount}/${report.failedCount}`);
  console.log(`Mémoire peak  : ${report.peakMemoryMB} MB`);
  console.log("\nRapports écrits dans benchmark/report.json et report.txt");
}

void runBenchmark().catch((err) => {
  console.error("Benchmark échoué :", err);
  process.exit(1);
});
