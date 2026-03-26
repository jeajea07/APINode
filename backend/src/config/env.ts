import "dotenv/config";
import path from "node:path";

function toPort(value: string | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export const ENV = {
  MONGO_URI: process.env.MONGODB_URI ?? "mongodb://localhost:27017/pdf_db",
  REDIS_HOST: process.env.REDIS_HOST ?? "localhost",
  REDIS_PORT: toPort(process.env.REDIS_PORT, 6379),
  BATCH: (() => {
    const min = Math.max(1, toInt(process.env.BATCH_MIN_SIZE, 1));
    const max = Math.max(1, toInt(process.env.BATCH_MAX_SIZE, 5000));
    return {
      MIN: Math.min(min, max),
      MAX: Math.max(min, max),
    };
  })(),
  PDF: {
    STORAGE_PATH: path.resolve(process.env.PDF_STORAGE_PATH ?? "storage/pdfs"),
    PREFIX: process.env.PDF_PREFIX ?? "user_"
  }
} as const;
