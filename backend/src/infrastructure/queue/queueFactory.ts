import Redis from "ioredis";

import { logger } from "../../config/logger";
import { redisConnection } from "../../config/redis";
import { documentQueue } from "../../queues/documentQueue";
import { MemoryQueue } from "./memoryQueue";

export type QueueJobInput<TData = unknown> = {
  name: string;
  data: TData;
};

export type IQueue = {
  addBulk: (jobs: Array<QueueJobInput>) => Promise<unknown>;
  close: () => Promise<void>;
};

let memoryQueueSingleton: MemoryQueue | null = null;

function getMemoryQueueSingleton(): MemoryQueue {
  if (!memoryQueueSingleton) memoryQueueSingleton = new MemoryQueue();
  return memoryQueueSingleton;
}

async function pingRedisWithTimeout(timeoutMs: number): Promise<boolean> {
  const client = new Redis({
    host: redisConnection.host,
    port: redisConnection.port,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });

  try {
    const ping = client.ping();
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Redis ping timeout")), timeoutMs);
    });

    await Promise.race([ping, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.quit();
    } catch {
      // ignore
    }
  }
}

export async function createQueue(): Promise<IQueue> {
  const redisOk = await pingRedisWithTimeout(2000);
  if (redisOk) return documentQueue;

  logger.warn("Redis indisponible — fallback mémoire actif");
  return getMemoryQueueSingleton() as unknown as IQueue;
}

