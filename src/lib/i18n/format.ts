/**
 * Locale-aware formatting of dates, durations, sizes, and lists, always through CLDR data via
 * `Intl`, in the active interface language. Nothing here is formatted by hand.
 *
 * Exception: CLDR has no Interslavic data, and `Intl` would silently fall back to English.
 * For Interslavic the same values are formatted by the `cldr-*` messages of
 * `src/locales/isv-Latn/feedtubes.ftl`, whose numbers Fluent still formats with `Intl`.
 */
import { FluentNumber } from "@fluent/bundle";
import { currentLanguage, currentLocaleTag, lacksCldrData, t, tCldrGap } from "./index.js";
import type { CldrGapKey } from "./keys.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Largest unit first: the unit a relative time is expressed in, and its CLDR-gap message. */
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number, CldrGapKey])[] = [
  ["year", 365 * DAY, "cldr-years-ago"],
  ["month", 30 * DAY, "cldr-months-ago"],
  ["week", 7 * DAY, "cldr-weeks-ago"],
  ["day", DAY, "cldr-days-ago"],
  ["hour", HOUR, "cldr-hours-ago"],
  ["minute", MINUTE, "cldr-minutes-ago"],
];

/** `Intl` formatters are costly to create; cache them per locale and options. */
const formatters = new Map<string, unknown>();

function cached<T>(kind: string, options: object, create: (tag: string) => T): T {
  const tag = currentLocaleTag();
  const key = `${kind}|${tag}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key) as T | undefined;
  if (formatter === undefined) {
    formatter = create(tag);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Numeric date and minutes in the local time zone, 24-hour: `05.11.2026, 16:01` in German. */
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

export function formatDateTime(date: Date): string {
  if (lacksCldrData(currentLanguage())) {
    const twoDigits = { minimumIntegerDigits: 2 };
    return tCldrGap("cldr-datetime", {
      year: new FluentNumber(date.getFullYear(), { useGrouping: false }),
      month: new FluentNumber(date.getMonth() + 1, twoDigits),
      day: new FluentNumber(date.getDate(), twoDigits),
      hour: new FluentNumber(date.getHours(), twoDigits),
      minute: new FluentNumber(date.getMinutes(), twoDigits),
    });
  }
  return cached(
    "date",
    DATE_TIME_OPTIONS,
    (tag) => new Intl.DateTimeFormat(tag, DATE_TIME_OPTIONS)
  ).format(date);
}

/** How long before `now` `date` was: "just now", "3 minutes ago", "yesterday", … */
export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  const unit = RELATIVE_UNITS.find(([, length]) => elapsed >= length);
  if (!unit) {
    return t("time-just-now");
  }
  const [name, length, gapId] = unit;
  const count = Math.floor(elapsed / length);
  if (lacksCldrData(currentLanguage())) {
    return tCldrGap(gapId, { count });
  }
  const options = { numeric: "auto" } as const;
  return cached("relative", options, (tag) => new Intl.RelativeTimeFormat(tag, options)).format(
    -count,
    name
  );
}

/**
 * A wait time, rounded up: minutes below an hour (`3 min`), hours above (`22 h`). Most sources
 * cool down for minutes; some platforms (Pixabay) for a day.
 */
export function formatWait(milliseconds: number): string {
  const minutes = Math.max(1, Math.ceil(milliseconds / MINUTE));
  const [unit, count]: ["minute" | "hour", number] =
    minutes < 60 ? ["minute", minutes] : ["hour", Math.ceil(minutes / 60)];
  if (lacksCldrData(currentLanguage())) {
    return tCldrGap(unit === "minute" ? "cldr-minutes-short" : "cldr-hours-short", { count });
  }
  const options = { style: "unit", unit, unitDisplay: "short" } as const;
  return cached("unit", options, (tag) => new Intl.NumberFormat(tag, options)).format(count);
}

/** CLDR's kilobyte and megabyte units are decimal (SI): 1 kB = 1000 B. */
const KILOBYTE = 1000;
const MEGABYTE = KILOBYTE * KILOBYTE;

/** A storage size: `358 byte`, `1.5 kB`, `2.3 MB` in English (at most one decimal). */
export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const [unit, amount, gapId]: ["byte" | "kilobyte" | "megabyte", number, CldrGapKey] =
    value < KILOBYTE
      ? ["byte", value, "cldr-bytes"]
      : value < MEGABYTE
        ? ["kilobyte", value / KILOBYTE, "cldr-kilobytes"]
        : ["megabyte", value / MEGABYTE, "cldr-megabytes"];
  if (lacksCldrData(currentLanguage())) {
    return tCldrGap(gapId, { count: new FluentNumber(amount, { maximumFractionDigits: 1 }) });
  }
  const options = { style: "unit", unit, maximumFractionDigits: 1 } as const;
  return cached("unit", options, (tag) => new Intl.NumberFormat(tag, options)).format(amount);
}

/** Joins items as a list: "a, b, and c" in English, "a, b und c" in German. */
export function formatList(items: readonly string[]): string {
  if (lacksCldrData(currentLanguage())) {
    if (items.length < 2) {
      return items[0] ?? "";
    }
    const tail = tCldrGap("cldr-list-pair", {
      head: items[items.length - 2] ?? "",
      tail: items[items.length - 1] ?? "",
    });
    return items
      .slice(0, -2)
      .reduceRight((rest, item) => tCldrGap("cldr-list-more", { head: item, tail: rest }), tail);
  }
  const options = { style: "long", type: "conjunction" } as const;
  return cached("list", options, (tag) => new Intl.ListFormat(tag, options)).format(items);
}
