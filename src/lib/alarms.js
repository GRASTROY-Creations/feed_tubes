import { REFRESH_INTERVAL_DEFAULT, REFRESH_INTERVAL_OPTIONS } from "./storage.js";

export const REFRESH_ALARM = "ytf-refresh";

export function normalizeInterval(value) {
  const interval = Number(value);
  return REFRESH_INTERVAL_OPTIONS.includes(interval) ? interval : REFRESH_INTERVAL_DEFAULT;
}

export async function scheduleRefreshAlarm(settings) {
  await browser.alarms.clear(REFRESH_ALARM);

  if (!settings?.refresh?.enabled) {
    return null;
  }

  const periodInMinutes = normalizeInterval(settings.refresh.intervalMinutes);
  browser.alarms.create(REFRESH_ALARM, { periodInMinutes });
  return periodInMinutes;
}

export async function ensureRefreshAlarm(settings) {
  const existing = await browser.alarms.get(REFRESH_ALARM);
  if (existing) {
    return existing;
  }
  return scheduleRefreshAlarm(settings);
}
