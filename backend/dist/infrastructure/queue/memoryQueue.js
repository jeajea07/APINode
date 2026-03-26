"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryQueue = void 0;
const logger_1 = require("../../config/logger");
class MemoryQueue {
    fifo = [];
    handler = null;
    interval = null;
    inFlight = 0;
    closed = false;
    async addBulk(jobs) {
        for (const job of jobs) {
            this.fifo.push(job);
            logger_1.logger.warn("Redis indisponible — fallback mémoire actif", { jobName: job.name });
        }
    }
    process(handler, concurrency) {
        if (this.interval)
            return;
        this.handler = handler;
        const safeConcurrency = Math.max(1, Math.floor(concurrency));
        this.interval = setInterval(() => {
            if (this.closed)
                return;
            if (!this.handler)
                return;
            while (this.inFlight < safeConcurrency && this.fifo.length > 0) {
                const job = this.fifo.shift();
                if (!job)
                    break;
                this.inFlight++;
                Promise.resolve(this.handler(job))
                    .catch((err) => {
                    logger_1.logger.error("MemoryQueue job failed", {
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
    async close() {
        this.closed = true;
        if (this.interval)
            clearInterval(this.interval);
        this.interval = null;
    }
    getSize() {
        return this.fifo.length;
    }
}
exports.MemoryQueue = MemoryQueue;
//# sourceMappingURL=memoryQueue.js.map