/** Narrowing helpers for untrusted values (storage, JSON payloads, messages). */

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Returns `value` as a record, or an empty record when it is not one. */
export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

/** Returns `value` as an array, or an empty array when it is not one. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/** Converts strings and finite numbers to a string; everything else becomes `""`. */
export function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}
