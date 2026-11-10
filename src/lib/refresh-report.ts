import { formatList, formatWait as formatDuration } from "./i18n/format.js";
import { t } from "./i18n/index.js";
import type { RefreshSummary } from "./refresh.js";

export interface RefreshReport {
  message: string;
  error: boolean;
}

/** Time until `nextRefreshAt`, rounded up: `"3 min"` below an hour, `"23 hr"` above. */
export function formatWait(nextRefreshAt: string | null, now: Date): string {
  const remaining = (Date.parse(nextRefreshAt ?? "") || now.getTime()) - now.getTime();
  return formatDuration(remaining);
}

/** User-facing summary of a manual refresh, including sources skipped by the cooldown. */
export function describeRefresh(
  summary: Pick<RefreshSummary, "total" | "failures" | "throttled" | "nextRefreshAt">,
  now = new Date()
): RefreshReport {
  const { total, failures, throttled, nextRefreshAt } = summary;
  if (total === 0) {
    return { message: t("refresh-no-subscriptions"), error: false };
  }

  const wait = t("refresh-next-in", { time: formatWait(nextRefreshAt, now) });
  const fetched = total - throttled;
  if (fetched === 0) {
    return { message: t("refresh-all-recent", { wait }), error: false };
  }

  const parts = [t("refresh-refreshed", { count: fetched })];
  if (failures > 0) {
    parts.push(t("refresh-failed", { count: failures }));
  }
  if (throttled > 0) {
    parts.push(t("refresh-skipped", { count: throttled, wait }));
  }
  return { message: t("refresh-summary", { parts: formatList(parts) }), error: failures > 0 };
}
