function toInt(value: unknown, fallback: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const rawMin = toInt(import.meta.env.VITE_BATCH_MIN, 1);
const rawMax = toInt(import.meta.env.VITE_BATCH_MAX, 5000);

const min = Math.max(1, rawMin);
const max = Math.max(1, rawMax);

export const BATCH_LIMITS = {
  MIN: Math.min(min, max),
  MAX: Math.max(min, max),
} as const;
