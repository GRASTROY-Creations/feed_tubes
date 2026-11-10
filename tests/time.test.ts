import { afterEach, describe, expect, it } from "bun:test";
import { setLanguage } from "../src/lib/i18n/index.js";
import { formatDateTime } from "../src/lib/time.js";

afterEach(() => {
  setLanguage("eng");
});

describe("formatDateTime", () => {
  it("formats local time numerically, 24-hour, in the interface language", () => {
    expect(formatDateTime(new Date(2026, 0, 2, 3, 4, 59))).toBe("01/02/2026, 03:04");
    setLanguage("deu");
    expect(formatDateTime(new Date(2026, 10, 30, 23, 59))).toBe("30.11.2026, 23:59");
  });

  it("accepts ISO strings", () => {
    const iso = new Date(2026, 10, 6, 16, 1).toISOString();
    expect(formatDateTime(iso)).toBe("11/06/2026, 16:01");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime("not a date")).toBe("");
    expect(formatDateTime(null)).toBe("");
  });
});
