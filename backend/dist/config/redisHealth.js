"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRedisConnection = checkRedisConnection;
exports.closeRedisHealthClient = closeRedisHealthClient;
const ioredis_1 = __importDefault(require("ioredis"));
const redis_1 = require("./redis");
let redisClient = null;
function getRedisClient() {
    if (redisClient)
        return redisClient;
    redisClient = new ioredis_1.default({
        host: redis_1.redisConnection.host,
        port: redis_1.redisConnection.port,
        // Keep health checks lightweight and quick to fail.
        maxRetriesPerRequest: 1,
        enableReadyCheck: true
    });
    return redisClient;
}
async function checkRedisConnection() {
    const client = getRedisClient();
    try {
        const res = await client.ping();
        return res === "PONG";
    }
    catch {
        return false;
    }
}
async function closeRedisHealthClient() {
    if (!redisClient)
        return;
    const client = redisClient;
    redisClient = null;
    try {
        await client.quit();
    }
    catch {
        // ignore
    }
}
//# sourceMappingURL=redisHealth.js.map