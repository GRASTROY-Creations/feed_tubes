import { REFRESH_INTERVAL_DEFAULT, REFRESH_INTERVAL_OPTIONS } from "./storage.js";
import type { Settings } from "./types.js";

/** Periodic wake-up that refreshes the subscriptions that are due. */
export const REFRESH_ALARM = "ytf-refresh";
/** One-shot wake-up that works through the rest of a large list after a run. */
export const REFRESH_CONTINUE_ALARM = "ytf-refresh-continue";

/**
 * The periodic alarm only checks what is due, so it can wake more often than the check
 * interval: a source then waits at most this long past its due time.
 */
const MAX_WAKE_PERIOD_MINUTES = 30;
/** Break between two runs of a large list, so requests come in short bursts at most. */
export const CONTINUE_DELAY_MS = 2 * 60 * 1000;

export function normalizeInterval(value: unknown): number {
  const interval = Number(value);
  return REFRESH_INTERVAL_OPTIONS.includes(interval) ? interval : REFRESH_INTERVAL_DEFAULT;
}

/** Replaces the refresh alarm; returns the period in minutes, or `null` when disabled. */
export async function scheduleRefreshAlarm(settings: Settings): Promise<number | null> {
  await browser.alarms.clear(REFRESH_ALARM);

  if (!settings.refresh.enabled) {
    await browser.alarms.clear(REFRESH_CONTINUE_ALARM);
    return null;
  }

  const periodInMinutes = Math.min(
    normalizeInterval(settings.refresh.intervalMinutes),
    MAX_WAKE_PERIOD_MINUTES
  );
  await browser.alarms.create(REFRESH_ALARM, { periodInMinutes });
  return periodInMinutes;
}

/** Schedules the next run of a large list at `when` (ms), or cancels it when `null`. */
export async function scheduleContinuation(when: number | null): Promise<void> {
  if (when === null) {
    await browser.alarms.clear(REFRESH_CONTINUE_ALARM);
    return;
  }
  await browser.alarms.create(REFRESH_CONTINUE_ALARM, { when });
}

export async function getRefreshAlarm(): Promise<browser.alarms.Alarm | null> {
  return (await browser.alarms.get(REFRESH_ALARM)) ?? null;
}
