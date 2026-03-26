"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.documentQueue = new bullmq_1.Queue("pdf-generation", {
    connection: redis_1.redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
});
//# sourceMappingURL=documentQueue.js.map