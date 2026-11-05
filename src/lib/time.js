const RELATIVE_UNITS = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1],
];

export function parseDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeTime(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) {
    return "";
  }

  const differenceSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(differenceSeconds);

  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (absoluteSeconds >= seconds || unit === "second") {
      const amount = Math.round(differenceSeconds / seconds);
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(amount, unit);
    }
  }

  return "";
}

export function formatAbsoluteTime(value) {
  const date = parseDate(value);
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatLastUpdated(value) {
  const date = parseDate(value);
  if (!date) {
    return "Never updated";
  }

  return `Updated ${formatRelativeTime(date)}`;
}

export function toIsoString(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : "";
}
