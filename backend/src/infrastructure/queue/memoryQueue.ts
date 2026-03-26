import { logger } from "../../config/logger";

export type MemoryJob<TData = unknown> = {
  name: string;
  data: TData;
};

export class MemoryQueue {
  private readonly fifo: MemoryJob[] = [];
  private handler: ((job: MemoryJob) => Promise<unknown>) | null = null;
  private interval: NodeJS.Timeout | null = null;
  private inFlight = 0;
  private closed = false;

  async addBulk(jobs: Array<MemoryJob>): Promise<void> {
    for (const job of jobs) {
      this.fifo.push(job);
      logger.warn("Redis indisponible — fallback mémoire actif", { jobName: job.name });
    }
  }

  process(handler: (job: MemoryJob) => Promise<unknown>, concurrency: number): void {
    if (this.interval) return;
    this.handler = handler;

    const safeConcurrency = Math.max(1, Math.floor(concurrency));
    this.interval = setInterval(() => {
      if (this.closed) return;
      if (!this.handler) return;

      while (this.inFlight < safeConcurrency && this.fifo.length > 0) {
        const job = this.fifo.shift();
        if (!job) break;

        this.inFlight++;
        Promise.resolve(this.handler(job))
          .catch((err) => {
            logger.error("MemoryQueue job failed", {
              jobName: job.name,
              message: err instanceof Error ? err.message : String(err)
            });
          })
          .finally(() => {
            this.inFlight--;
          });
      }
    }, 500);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  getSize(): number {
    return this.fifo.length;
  }
}

