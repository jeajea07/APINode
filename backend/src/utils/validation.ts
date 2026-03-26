export type BatchIdsValidation =
  | { ok: true; ids: string[] }
  | { ok: false; error: string; received?: number };

export type BatchLimits = {
  min: number;
  max: number;
};

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

export function validateBatchIds(
  body: unknown,
  limits: BatchLimits = { min: 1, max: 5000 }
): BatchIdsValidation {
  const min = Math.max(1, Math.trunc(limits.min));
  const max = Math.max(min, Math.trunc(limits.max));
  const ids = Array.isArray(body) ? body : null;

  if (!ids) {
    return { ok: false, error: "Body must be an array of IDs" };
  }

  if (ids.length < min || ids.length > max) {
    const range = min === max ? `${min}` : `${min} and ${max}`;
    return {
      ok: false,
      error: `IDs array must contain between ${range} items`,
      received: ids.length,
    };
  }

  if (!ids.every(isNonEmptyString)) {
    return { ok: false, error: "All IDs must be non-empty strings" };
  }

  return { ok: true, ids };
}
