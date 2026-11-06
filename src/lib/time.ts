const SECONDS_PER_DAY = 24 * 60 * 60;

const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ["year", 365 * SECONDS_PER_DAY],
  ["month", 30 * SECONDS_PER_DAY],
  ["week", 7 * SECONDS_PER_DAY],
  ["day", SECONDS_PER_DAY],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** Numbers below this are treated as Unix seconds rather than milliseconds. */
const UNIX_SECONDS_THRESHOLD = 10_000_000_000;

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

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

export function formatRelativeTime(value: DateInput, now = new Date()): string {
  const date = parseDate(value);
  if (!date) {
    return "";
  }

  const differenceSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(differenceSeconds);
  const [unit, seconds] = RELATIVE_UNITS.find(
    ([, unitSeconds]) => absoluteSeconds >= unitSeconds
  ) ?? ["second", 1];

  return relativeFormatter.format(Math.round(differenceSeconds / seconds), unit);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local date and time as `yyyy-mm-dd hh:mm` (24-hour); `""` for missing or invalid input. */
export function formatDateTime(value: DateInput): string {
  const date = parseDate(value);
  if (!date) {
    return "";
  }
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `${day} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatLastUpdated(value: DateInput): string {
  const date = parseDate(value);
  return date ? `Updated ${formatRelativeTime(date)}` : "Never updated";
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
