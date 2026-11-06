import { describe, expect, it } from "bun:test";
import { formatDateTime } from "../src/lib/time.js";

describe("formatDateTime", () => {
  it("formats local time as yyyy-mm-dd hh:mm with zero padding", () => {
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 59))).toBe("2026-01-02 03:04");
    expect(formatDateTime(new Date(2026, 10, 30, 23, 59))).toBe("2026-11-30 23:59");
  });

  it("accepts ISO strings", () => {
    const iso = new Date(2026, 10, 6, 16, 1).toISOString();
    expect(formatDateTime(iso)).toBe("2026-11-06 16:01");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not a date")).toBe("");
    expect(formatDateTime(null)).toBe("");
  });
});
