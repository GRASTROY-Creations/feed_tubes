import { getRefreshAlarm, REFRESH_ALARM, scheduleRefreshAlarm } from "../lib/alarms.js";
import { errorMessage } from "../lib/errors.js";
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

/** The refresh in flight, shared by every caller so feeds are never fetched twice at once. */
let activeRefresh: Promise<RequestResponses["refresh-request"]> | null = null;

async function performRefresh(reason: RefreshReason): Promise<RequestResponses["refresh-request"]> {
  const state = await loadState();
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
    const message = errorMessage(error, "Refresh failed.");
    await saveRefreshState({ ...state.refreshState, running: false, startedAt: null });
    await broadcast({ type: "feed-updated", error: message, reason });
    return { ok: false, error: message };
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
      return { ok: false, error: errorMessage(error, "Could not update the alarm.") };
    }
  },

  "alarm-info": async () => {
    try {
      return { ok: true, alarm: await getRefreshAlarm() };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "Could not read the alarm.") };
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
