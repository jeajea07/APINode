"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQueue = createQueue;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../../config/logger");
const redis_1 = require("../../config/redis");
const documentQueue_1 = require("../../queues/documentQueue");
const memoryQueue_1 = require("./memoryQueue");
let memoryQueueSingleton = null;
function getMemoryQueueSingleton() {
    if (!memoryQueueSingleton)
        memoryQueueSingleton = new memoryQueue_1.MemoryQueue();
    return memoryQueueSingleton;
}
async function pingRedisWithTimeout(timeoutMs) {
    const client = new ioredis_1.default({
        host: redis_1.redisConnection.host,
        port: redis_1.redisConnection.port,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true
    });
    try {
        const ping = client.ping();
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Redis ping timeout")), timeoutMs);
        });
        await Promise.race([ping, timeout]);
        return true;
    }
    catch {
        return false;
    }
    finally {
        try {
            await client.quit();
        }
        catch {
            // ignore
        }
    }
}
async function createQueue() {
    const redisOk = await pingRedisWithTimeout(2000);
    if (redisOk)
        return documentQueue_1.documentQueue;
    logger_1.logger.warn("Redis indisponible — fallback mémoire actif");
    return getMemoryQueueSingleton();
}
//# sourceMappingURL=queueFactory.js.map