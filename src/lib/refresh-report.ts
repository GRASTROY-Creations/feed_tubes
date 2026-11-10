import type { RefreshSummary } from "./refresh.js";
import { pluralize } from "./text.js";

const MINUTE_MS = 60 * 1000;
const MINUTES_PER_HOUR = 60;

export interface RefreshReport {
  message: string;
  error: boolean;
}

/**
 * Time until `nextRefreshAt`, rounded up: `"3 min"` below an hour, `"23 h"` above.
 * Most sources cool down for minutes; some platforms (Pixabay) for a day.
 */
export function formatWait(nextRefreshAt: string | null, now: Date): string {
  const remaining = (Date.parse(nextRefreshAt ?? "") || now.getTime()) - now.getTime();
  const minutes = Math.max(1, Math.ceil(remaining / MINUTE_MS));
  return minutes < MINUTES_PER_HOUR
    ? `${minutes} min`
    : `${Math.ceil(minutes / MINUTES_PER_HOUR)} h`;
}

/** User-facing summary of a manual refresh, including sources skipped by the cooldown. */
export function describeRefresh(
  summary: Pick<RefreshSummary, "total" | "failures" | "throttled" | "nextRefreshAt">,
  now = new Date()
): RefreshReport {
  const { total, failures, throttled, nextRefreshAt } = summary;
  if (total === 0) {
    return { message: "Add an enabled subscription before refreshing.", error: false };
  }

  const wait = `next refresh in ${formatWait(nextRefreshAt, now)}`;
  const fetched = total - throttled;
  if (fetched === 0) {
    return { message: `All sources were refreshed recently; ${wait}.`, error: false };
  }

  const parts = [`Refreshed ${pluralize(fetched, "source")}`];
  if (failures > 0) {
    parts.push(`${failures} failed`);
  }
  if (throttled > 0) {
    parts.push(`${throttled} skipped (refreshed recently, ${wait})`);
  }
  return { message: `${parts.join("; ")}.`, error: failures > 0 };
}
