import {
  CONTINUE_DELAY_MS,
  getRefreshAlarm,
  REFRESH_ALARM,
  REFRESH_CONTINUE_ALARM,
  scheduleContinuation,
  scheduleRefreshAlarm,
} from "../lib/alarms.js";
import { toLocalizedText } from "../lib/errors.js";
import { fetchJson, fetchText, postJson } from "../lib/fetch.js";
import {
  broadcast,
  isRequest,
  type RefreshReason,
  type RequestResponses,
  type RequestType,
} from "../lib/messages.js";
import { createPermissionCheck, hostForSubscription } from "../lib/permissions.js";
import { refreshFeeds, type RefreshMode, type RefreshResult } from "../lib/refresh.js";
import {
  loadHostLimits,
  loadState,
  saveCache,
  saveHostLimits,
  saveRefreshState,
} from "../lib/storage.js";
import { subscriptionKey } from "../lib/subscriptions.js";
import { createHostThrottle } from "../lib/throttle.js";
import type { FeedCache, RefreshState } from "../lib/types.js";
import { applyLanguageSetting, loadLocales } from "../lib/i18n/index.js";

/**
 * Translations, loaded once per background page. Errors are stored as message ids, so the
 * background needs text only for the messages of the errors it creates (and their logs).
 */
const localesReady = loadLocales().catch((error: unknown) => {
  console.error("FeedTubes could not load its translations.", error);
});

type RefreshResponse = RequestResponses["refresh-request"];

/** The refresh in flight, shared by every caller so feeds are never fetched twice at once. */
let activeRefresh: Promise<RefreshResponse> | null = null;

/**
 * Saves `cache` without entries of subscriptions removed or disabled while the run was going,
 * so a long run never brings back what the user just deleted.
 */
async function saveCurrentCache(cache: FeedCache): Promise<void> {
  const { subscriptions } = await loadState();
  const enabled = new Set(
    subscriptions
      .filter((subscription) => subscription.enabled)
      .map((subscription) => subscriptionKey(subscription))
  );
  await saveCache(Object.fromEntries(Object.entries(cache).filter(([key]) => enabled.has(key))));
}

/** When the rest of a large list should be fetched, or `null` when nothing is left. */
function continuationTime(result: RefreshResult, now: number): number | null {
  if (result.pending > 0) {
    return now + CONTINUE_DELAY_MS;
  }
  if (result.deferred > 0) {
    const resumeAt = Date.parse(result.resumeAt ?? "") || 0;
    return Math.max(now + CONTINUE_DELAY_MS, resumeAt);
  }
  return null;
}

async function performRefresh(reason: RefreshReason, mode: RefreshMode): Promise<RefreshResponse> {
  const [state, hostLimits] = await Promise.all([loadState(), loadHostLimits(), localesReady]);
  applyLanguageSetting(state.settings.ui.language);
  const startedAt = new Date().toISOString();
  const runningState: RefreshState = { ...state.refreshState, running: true, startedAt };
  await saveRefreshState(runningState);

  // Every request of this run goes through one throttle. Its hourly budget and host pauses
  // are stored, so they hold across runs and background restarts.
  const throttle = createHostThrottle(hostLimits);
  const persistThrottle = (): Promise<void> => saveHostLimits(throttle.snapshot());

  try {
    const result = await refreshFeeds({
      subscriptions: state.subscriptions,
      settings: state.settings,
      previousCache: state.cache,
      mode,
      checkPermission: createPermissionCheck(),
      ...throttle.wrap({ fetchText, fetchJson, postJson }),
      hostBlockedUntil: (subscription) => throttle.blockedUntil(hostForSubscription(subscription)),
      onProgress: async ({ cache, done, planned }) => {
        await Promise.all([saveCurrentCache(cache), persistThrottle()]);
        await broadcast({ type: "feed-updated", reason, progress: { done, planned } });
      },
    });

    const { cache, ...summary } = result;
    const fetched = summary.total - summary.throttled - summary.pending - summary.deferred;

    await Promise.all([saveCurrentCache(cache), persistThrottle()]);
    await saveRefreshState({
      running: false,
      startedAt: null,
      // When nothing was fetched, the feed is as old as it was.
      lastCompletedAt: fetched > 0 ? summary.completedAt : state.refreshState.lastCompletedAt,
      pending: summary.pending + summary.deferred,
    });
    // With background fetching off, the rest of a large list waits for the next manual or
    // on-open refresh.
    if (state.settings.refresh.enabled) {
      await scheduleContinuation(continuationTime(result, Date.now()));
    }

    await broadcast({
      type: "feed-updated",
      total: summary.total,
      failures: summary.failures,
      fetched,
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

function runRefresh(reason: RefreshReason, mode: RefreshMode): Promise<RefreshResponse> {
  activeRefresh ??= performRefresh(reason, mode).finally(() => {
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
  "refresh-request": () => runRefresh("manual", "manual"),
  "refresh-due": () => runRefresh("open", "due"),

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
    void runRefresh("alarm", "due");
  } else if (alarm.name === REFRESH_CONTINUE_ALARM) {
    void runRefresh("continue", "due");
  }
});

/**
 * A run lives only as long as the background page that started it. A fresh page has no run
 * in flight, so a stored `running` flag is left over from a page that was stopped mid-run.
 */
async function clearInterruptedRun(): Promise<void> {
  const { refreshState } = await loadState();
  if (refreshState.running && !activeRefresh) {
    await saveRefreshState({ ...refreshState, running: false, startedAt: null });
  }
}

function onLifecycleEvent(): void {
  Promise.all([rescheduleAlarm(), clearInterruptedRun()]).catch((error: unknown) => {
    console.warn("FeedTubes could not schedule the refresh alarm.", error);
  });
}

browser.runtime.onInstalled.addListener(onLifecycleEvent);
browser.runtime.onStartup.addListener(onLifecycleEvent);
