import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "Missing MONGODB_URI environment variable"),
  REDIS_HOST: z.string().min(1, "Missing REDIS_HOST environment variable"),
  REDIS_PORT: z.coerce.number().int().positive(),
  BATCH_MIN_SIZE: z.coerce.number().int().positive().default(1),
  BATCH_MAX_SIZE: z.coerce.number().int().positive().default(5000),
  PDF_STORAGE_PATH: z.string().min(1, "Missing PDF_STORAGE_PATH environment variable"),
  PDF_PREFIX: z.string().min(1).default("user_"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:8080"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  LOG_LEVEL: z.string().min(1).default("info"),
  SERVICE_NAME: z.string().min(1).default("api-node")
});

const parsed = envSchema.parse(process.env);

const batchMin = Math.max(1, parsed.BATCH_MIN_SIZE);
const batchMax = Math.max(1, parsed.BATCH_MAX_SIZE);

export const ENV = {
  MONGO_URI: parsed.MONGODB_URI,
  REDIS_HOST: parsed.REDIS_HOST,
  REDIS_PORT: parsed.REDIS_PORT,
  PORT: parsed.PORT,
  FRONTEND_ORIGIN: parsed.FRONTEND_ORIGIN,
  RATE_LIMIT_WINDOW_MS: parsed.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX: parsed.RATE_LIMIT_MAX,
  LOG_LEVEL: parsed.LOG_LEVEL,
  SERVICE_NAME: parsed.SERVICE_NAME,
  BATCH: {
    MIN: Math.min(batchMin, batchMax),
    MAX: Math.max(batchMin, batchMax)
  },
  PDF: {
    STORAGE_PATH: path.resolve(parsed.PDF_STORAGE_PATH),
    PREFIX: parsed.PDF_PREFIX
  }
} as const;