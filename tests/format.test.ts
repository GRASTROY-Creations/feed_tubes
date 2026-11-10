import { afterEach, describe, expect, it } from "bun:test";
import {
  formatBytes,
  formatDateTime,
  formatList,
  formatRelativeTime,
  formatWait,
} from "../src/lib/i18n/format.js";
import { setLanguage, type Language } from "../src/lib/i18n/index.js";

afterEach(() => {
  setLanguage("eng");
});

const NOW = new Date("2026-11-10T12:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);
const MINUTE = 60_000;

function inLanguage<T>(language: Language, format: () => T): T {
  setLanguage(language);
  return format();
}

describe("formatDateTime", () => {
  const date = new Date(2026, 10, 5, 16, 1);

  it("uses each language's numeric CLDR format, 24-hour", () => {
    expect(inLanguage("eng", () => formatDateTime(date))).toBe("11/05/2026, 16:01");
    expect(inLanguage("deu", () => formatDateTime(date))).toBe("05.11.2026, 16:01");
    expect(inLanguage("rus", () => formatDateTime(date))).toBe("05.11.2026, 16:01");
  });

  it("uses the Interslavic catalog format, in both scripts", () => {
    expect(inLanguage("isv-Latn", () => formatDateTime(date))).toBe("05.11.2026 16:01");
    expect(inLanguage("isv-Cyrl", () => formatDateTime(date))).toBe("05.11.2026 16:01");
  });
});

describe("formatRelativeTime", () => {
  it("uses Intl.RelativeTimeFormat", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(3), NOW)).toBe("3 minutes ago");
    expect(formatRelativeTime(ago(60 * 26), NOW)).toBe("yesterday");
    expect(inLanguage("deu", () => formatRelativeTime(ago(3), NOW))).toBe("vor 3 Minuten");
    expect(inLanguage("rus", () => formatRelativeTime(ago(5), NOW))).toBe("5 минут назад");
  });

  it("uses the Interslavic catalog with Russian plural forms", () => {
    setLanguage("isv-Latn");
    const forms = [1, 3, 5].map((minutes) => formatRelativeTime(ago(minutes), NOW));
    expect(new Set(forms).size).toBe(3);
    expect(forms[1]).toMatch(/^3 \S+/);
    setLanguage("isv-Cyrl");
    expect(formatRelativeTime(ago(3), NOW)).not.toMatch(/[A-Za-z]/);
  });
});

describe("formatWait", () => {
  it("rounds up to minutes or hours, as Intl units", () => {
    expect(formatWait(2.5 * MINUTE)).toBe("3 min");
    expect(formatWait(21.5 * 60 * MINUTE)).toBe("22 hr");
    expect(inLanguage("deu", () => formatWait(3 * MINUTE))).toBe("3 Min.");
    expect(inLanguage("rus", () => formatWait(3 * MINUTE))).toBe("3 мин");
  });

  it("uses the Interslavic catalog", () => {
    expect(inLanguage("isv-Latn", () => formatWait(3 * MINUTE))).toBe("3 min");
  });
});

describe("formatBytes", () => {
  it("formats sizes with CLDR units and at most one decimal", () => {
    expect(formatBytes(358)).toBe("358 byte");
    expect(formatBytes(1500)).toBe("1.5 kB");
    expect(formatBytes(Number.NaN)).toBe("0 byte");
    expect(inLanguage("deu", () => formatBytes(1500))).toBe("1,5 kB");
  });

  it("uses the Interslavic catalog with Intl-formatted numbers", () => {
    expect(inLanguage("isv-Latn", () => formatBytes(1500))).toBe("1,5 KB");
  });
});

describe("formatList", () => {
  it("joins with each language's conjunction", () => {
    expect(formatList(["a", "b", "c"])).toBe("a, b, and c");
    expect(inLanguage("deu", () => formatList(["a", "b", "c"]))).toBe("a, b und c");
    expect(formatList(["a"])).toBe("a");
  });

  it("uses the Interslavic catalog", () => {
    setLanguage("isv-Latn");
    expect(formatList(["a", "b", "c"])).toBe("a, b i c");
    expect(formatList(["a", "b"])).toBe("a i b");
    setLanguage("isv-Cyrl");
    expect(formatList(["a", "b"])).toBe("a и b");
  });
});
