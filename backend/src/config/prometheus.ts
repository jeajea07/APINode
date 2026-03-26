import * as promClient from "prom-client";

import type { JobType } from "bullmq";
export const documentsGeneratedTotal = new promClient.Counter({
  name: "documents_generated_total",
  help: "Nombre total de documents générés",
  labelNames: ["status"],
  registers: [promClient.register]
});

export const batchProcessingDurationSeconds = new promClient.Histogram({
  name: "batch_processing_duration_seconds",
  help: "Durée de traitement d'un batch (fin: completed/failed)",
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [promClient.register]
});

export const pdfGenerationDurationSeconds = new promClient.Histogram({
  name: "pdf_generation_duration_seconds",
  help: "Durée de génération PDF",
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [promClient.register]
});

export const queueSizeGauge = new promClient.Gauge({
  name: "queue_size",
  help: "Taille estimée de la queue (waiting + delayed)",
  registers: [promClient.register]
});

type QueueForGauge = {
  getJobCounts: (...types: JobType[]) => Promise<Record<string, number>>;
};

let gaugeInterval: NodeJS.Timeout | null = null;

export function startQueueSizeGauge(queue: QueueForGauge): void {
  if (gaugeInterval) return;

  const tick = async (): Promise<void> => {
    try {
      // waiting + delayed is a good approximation of "work not yet started"
      const counts = await queue.getJobCounts("waiting", "delayed");
      const size = (counts.waiting ?? 0) + (counts.delayed ?? 0);
      queueSizeGauge.set(size);
    } catch {
      // Avoid crashing the API when Redis/BullMQ is temporarily unhealthy.
      queueSizeGauge.set(0);
    }
  };

  void tick();
  gaugeInterval = setInterval(() => {
    void tick();
  }, 5000);
}

export function stopQueueSizeGauge(): void {
  if (!gaugeInterval) return;
  clearInterval(gaugeInterval);
  gaugeInterval = null;
}

export const register = promClient.register;

