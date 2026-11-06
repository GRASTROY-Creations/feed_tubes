import { REFRESH_INTERVAL_DEFAULT, REFRESH_INTERVAL_OPTIONS } from "./storage.js";
import type { Settings } from "./types.js";

export const REFRESH_ALARM = "ytf-refresh";

export function normalizeInterval(value: unknown): number {
  const interval = Number(value);
  return REFRESH_INTERVAL_OPTIONS.includes(interval) ? interval : REFRESH_INTERVAL_DEFAULT;
}

/** Replaces the refresh alarm; returns the period in minutes, or `null` when disabled. */
export async function scheduleRefreshAlarm(settings: Settings): Promise<number | null> {
  await browser.alarms.clear(REFRESH_ALARM);

  if (!settings.refresh.enabled) {
    return null;
  }

  const periodInMinutes = normalizeInterval(settings.refresh.intervalMinutes);
  await browser.alarms.create(REFRESH_ALARM, { periodInMinutes });
  return periodInMinutes;
}

export async function getRefreshAlarm(): Promise<browser.alarms.Alarm | null> {
  return (await browser.alarms.get(REFRESH_ALARM)) ?? null;
}
