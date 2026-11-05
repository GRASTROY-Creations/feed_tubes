import { REFRESH_ALARM, scheduleRefreshAlarm } from "../lib/alarms.js";
import { fetchJson, fetchText } from "../lib/fetch.js";
import { hasPermissionForSubscription } from "../lib/permissions.js";
import { refreshFeeds } from "../lib/refresh.js";
import { loadState, saveCache, saveRefreshState } from "../lib/storage.js";

let activeRefresh = null;

async function notifySidebar(message) {
  try {
    await browser.runtime.sendMessage(message);
  } catch {
    // No sidebar is open.
  }
}

async function runRefresh(reason) {
  if (activeRefresh) {
    return activeRefresh;
  }

  activeRefresh = (async () => {
    const state = await loadState();
    const startedAt = new Date().toISOString();

    await saveRefreshState({
      ...state.refreshState,
      running: true,
      startedAt,
    });

    try {
      if (!state.subscriptions.some((subscription) => subscription.enabled)) {
        await saveRefreshState({
          running: false,
          startedAt: null,
          lastCompletedAt: startedAt,
        });
        await notifySidebar({ type: "feed-updated", total: 0, failures: 0, reason });
        return { ok: true, total: 0, failures: 0, completedAt: startedAt };
      }

      const result = await refreshFeeds({
        subscriptions: state.subscriptions,
        settings: state.settings,
        previousCache: state.cache,
        checkPermission: hasPermissionForSubscription,
        fetchText,
        fetchJson,
      });

      await saveCache(result.cache);
      await saveRefreshState({
        running: false,
        startedAt: null,
        lastCompletedAt: result.completedAt,
      });
      await notifySidebar({
        type: "feed-updated",
        total: result.total,
        failures: result.failures,
        reason,
      });

      return { ok: true, ...result };
    } catch (error) {
      await saveRefreshState({
        ...state.refreshState,
        running: false,
        startedAt: null,
      });
      await notifySidebar({
        type: "feed-updated",
        error: error?.message || "Refresh failed.",
        reason,
      });
      return { ok: false, error: error?.message || "Refresh failed." };
    }
  })();

  try {
    return await activeRefresh;
  } finally {
    activeRefresh = null;
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  if (message.type === "refresh-request") {
    return runRefresh("manual");
  }

  if (message.type === "settings-changed") {
    return loadState()
      .then((state) => scheduleRefreshAlarm(state.settings))
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: error?.message || "Could not update the alarm." }));
  }

  if (message.type === "alarm-info") {
    return browser.alarms
      .get(REFRESH_ALARM)
      .then((alarm) => ({ ok: true, alarm: alarm || null }))
      .catch((error) => ({ ok: false, error: error?.message || "Could not read the alarm." }));
  }

  return undefined;
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    runRefresh("alarm");
  }
});

browser.runtime.onInstalled.addListener(() => {
  loadState()
    .then((state) => scheduleRefreshAlarm(state.settings))
    .catch(() => {});
});

browser.runtime.onStartup.addListener(() => {
  loadState()
    .then((state) => scheduleRefreshAlarm(state.settings))
    .catch(() => {});
});
