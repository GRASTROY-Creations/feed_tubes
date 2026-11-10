import {
  formatDateTime as formatDateTimeIntl,
  formatRelativeTime as formatRelativeTimeIntl,
} from "./i18n/format.js";
import { t } from "./i18n/index.js";

/** Numbers below this are treated as Unix seconds rather than milliseconds. */
const UNIX_SECONDS_THRESHOLD = 10_000_000_000;

export type DateInput = Date | string | number | null | undefined;

export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "" || value === 0) {
    return null;
  }

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value < UNIX_SECONDS_THRESHOLD ? value * 1000 : value);
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

/** How long ago `value` was, in the interface language: "just now", "3 minutes ago", … */
export function formatRelativeTime(value: DateInput, now = new Date()): string {
  const date = parseDate(value);
  return date ? formatRelativeTimeIntl(date, now) : "";
}

/** Local date and time in the interface language's numeric format; `""` when missing. */
export function formatDateTime(value: DateInput): string {
  const date = parseDate(value);
  return date ? formatDateTimeIntl(date) : "";
}

export function formatLastUpdated(value: DateInput): string {
  const date = parseDate(value);
  return date ? t("time-updated", { time: formatRelativeTime(date) }) : t("time-never-fetched");
}

export function toIsoString(value: DateInput): string {
  return parseDate(value)?.toISOString() ?? "";
}

function timestampOf(value: string): number {
  return Date.parse(value) || 0;
}

/** Sort comparator: newest `publishedAt` first; undated items last. */
export function byPublishedDesc(
  left: { readonly publishedAt: string },
  right: { readonly publishedAt: string }
): number {
  return timestampOf(right.publishedAt) - timestampOf(left.publishedAt);
}
