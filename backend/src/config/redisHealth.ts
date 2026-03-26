import Redis from "ioredis";
import { redisConnection } from "./redis";

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  redisClient = new Redis({
    host: redisConnection.host,
    port: redisConnection.port,
    // Keep health checks lightweight and quick to fail.
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });

  return redisClient;
}

export async function checkRedisConnection(): Promise<boolean> {
  const client = getRedisClient();
  try {
    const res = await client.ping();
    return res === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedisHealthClient(): Promise<void> {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  try {
    await client.quit();
  } catch {
    // ignore
  }
}

