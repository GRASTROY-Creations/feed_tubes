import { REFRESH_COOLDOWN_MS, type RefreshSummary } from "./refresh.js";
import { pluralize } from "./text.js";

const MINUTE_MS = 60 * 1000;
const COOLDOWN_MINUTES = REFRESH_COOLDOWN_MS / MINUTE_MS;

export interface RefreshReport {
  message: string;
  error: boolean;
}

/** Whole minutes until `nextRefreshAt`, at least 1. */
function minutesUntil(nextRefreshAt: string | null, now: Date): number {
  const remaining = (Date.parse(nextRefreshAt ?? "") || now.getTime()) - now.getTime();
  return Math.max(1, Math.ceil(remaining / MINUTE_MS));
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

  const wait = `next refresh in ${minutesUntil(nextRefreshAt, now)} min`;
  const fetched = total - throttled;
  if (fetched === 0) {
    return {
      message: `All sources were refreshed less than ${COOLDOWN_MINUTES} minutes ago; ${wait}.`,
      error: false,
    };
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
