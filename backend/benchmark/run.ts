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

  while (status !== "completed" && status !== "failed") {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    const getRes = await fetch(`${API_BASE}/api/documents/batch/${batchId}`);
    const batch = (await getRes.json()) as {
      status: string;
      processedCount: number;
      failedCount: number;
      totalDocuments: number;
    };

    status = batch.status;
    const elapsedSec = (Date.now() - startTime) / 1000;
    const processed = batch.processedCount ?? 0;
    const docsPerSec = Math.round(processed / Math.max(1, elapsedSec));

    timeline.push({
      timestamp: new Date().toISOString(),
      processed,
      failed: batch.failedCount ?? 0,
      docsPerSec
    });

    console.log(
      `[${Math.round(elapsedSec)}s] status=${status} ` +
        `processed=${processed}/${batch.totalDocuments} ` +
        `failed=${batch.failedCount ?? 0} ` +
        `docs/s=${docsPerSec}`
    );
  }

  // Étape 3 — Rapport
  const totalTimeMs = Date.now() - startTime;
  const last = timeline.at(-1);
  if (!last) throw new Error("No timeline entries collected");

  const report: BenchmarkReport = {
    totalTimeMs,
    docsPerSecond: Math.round(1000 / (totalTimeMs / 1000)),
    peakMemoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    failedCount: last.failed,
    successCount: last.processed,
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
