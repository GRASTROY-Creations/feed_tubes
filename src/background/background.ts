import { getRefreshAlarm, REFRESH_ALARM, scheduleRefreshAlarm } from "../lib/alarms.js";
import { toLocalizedText } from "../lib/errors.js";
import { fetchJson, fetchText, postJson } from "../lib/fetch.js";
import {
  broadcast,
  isRequest,
  type RefreshReason,
  type RequestResponses,
  type RequestType,
} from "../lib/messages.js";
import { hasPermissionForSubscription } from "../lib/permissions.js";
import { refreshFeeds } from "../lib/refresh.js";
import { loadState, saveCache, saveRefreshState } from "../lib/storage.js";
import { applyLanguageSetting, loadLocales } from "../lib/i18n/index.js";

/**
 * Translations, loaded once per background page. Errors are stored as message ids, so the
 * background needs text only for the messages of the errors it creates (and their logs).
 */
const localesReady = loadLocales().catch((error: unknown) => {
  console.error("FeedTubes could not load its translations.", error);
});

/** The refresh in flight, shared by every caller so feeds are never fetched twice at once. */
let activeRefresh: Promise<RequestResponses["refresh-request"]> | null = null;

async function performRefresh(reason: RefreshReason): Promise<RequestResponses["refresh-request"]> {
  const [state] = await Promise.all([loadState(), localesReady]);
  applyLanguageSetting(state.settings.ui.language);
  const startedAt = new Date().toISOString();
  await saveRefreshState({ ...state.refreshState, running: true, startedAt });

  try {
    const result = await refreshFeeds({
      subscriptions: state.subscriptions,
      settings: state.settings,
      previousCache: state.cache,
      checkPermission: hasPermissionForSubscription,
      fetchText,
      fetchJson,
      postJson,
    });

    const { cache, ...summary } = result;
    const fetchedAny = summary.total > summary.throttled;

    if (summary.total > 0) {
      await saveCache(cache);
    }
    await saveRefreshState({
      running: false,
      startedAt: null,
      // When every source was skipped by the cooldown, nothing new was fetched.
      lastCompletedAt: fetchedAny ? summary.completedAt : state.refreshState.lastCompletedAt,
    });

    await broadcast({
      type: "feed-updated",
      total: summary.total,
      failures: summary.failures,
      reason,
    });
    return { ok: true, ...summary };
  } catch (error) {
    const text = toLocalizedText(error, "background-refresh-failed");
    await saveRefreshState({ ...state.refreshState, running: false, startedAt: null });
    await broadcast({ type: "feed-updated", error: text, reason });
    return { ok: false, error: text };
  }
}

function runRefresh(reason: RefreshReason): Promise<RequestResponses["refresh-request"]> {
  activeRefresh ??= performRefresh(reason).finally(() => {
    activeRefresh = null;
  });
  return activeRefresh;
}

async function rescheduleAlarm(): Promise<void> {
  const state = await loadState();
  await scheduleRefreshAlarm(state.settings);
}

type RequestHandlers = { [T in RequestType]: () => Promise<RequestResponses[T]> };

const handlers: RequestHandlers = {
  "refresh-request": () => runRefresh("manual"),

  "settings-changed": async () => {
    try {
      await rescheduleAlarm();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toLocalizedText(error, "background-alarm-update-failed") };
    }
  },

  "alarm-info": async () => {
    try {
      return { ok: true, alarm: await getRefreshAlarm() };
    } catch (error) {
      return { ok: false, error: toLocalizedText(error, "background-alarm-read-failed") };
    }
  },
};

browser.runtime.onMessage.addListener((message: unknown) => {
  // Returning undefined lets other listeners (or nobody) answer unrelated messages.
  return isRequest(message) ? handlers[message.type]() : undefined;
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void runRefresh("alarm");
  }
});

function rescheduleOnLifecycleEvent(): void {
  rescheduleAlarm().catch((error: unknown) => {
    console.warn("FeedTubes could not schedule the refresh alarm.", error);
  });
}

browser.runtime.onInstalled.addListener(rescheduleOnLifecycleEvent);
browser.runtime.onStartup.addListener(rescheduleOnLifecycleEvent);
