import { HostLimitError, toLocalizedText } from "./errors.js";
import { getPlatform } from "./platforms/registry.js";
import { defaultSettings } from "./storage.js";
import { subscriptionKey } from "./subscriptions.js";
import { byPublishedDesc } from "./time.js";
import type {
  ApiKeys,
  CacheEntry,
  FeedCache,
  FeedItem,
  FeedSettings,
  FetchJson,
  FetchText,
  PostJson,
  RefreshSettings,
  Subscription,
} from "./types.js";
import type { LocalizedText } from "./i18n/index.js";

export interface RefreshDependencies {
  checkPermission: (subscription: Subscription) => Promise<boolean>;
  fetchText: FetchText;
  fetchJson: FetchJson;
  postJson: PostJson;
  /**
   * When the subscription's host may be asked again (ms), or `null` when it is available.
   * Paused or over-budget hosts are skipped without a request.
   */
  hostBlockedUntil?: (subscription: Subscription) => number | null;
  /** Called with the cache so far after every `PROGRESS_EVERY` finished sources. */
  onProgress?: (progress: RefreshProgress) => Promise<void> | void;
}

/**
 * - `due`: background and on-open refreshes. Only subscriptions whose check interval has
 *   passed are fetched.
 * - `manual`: the refresh button. Ignores the check interval, but keeps the short cooldown and
 *   the backoff of failing sources.
 */
export type RefreshMode = "due" | "manual";

export interface RefreshFeedsOptions extends RefreshDependencies {
  subscriptions: readonly Subscription[];
  settings?: {
    feed?: Partial<FeedSettings>;
    apiKeys?: Partial<ApiKeys>;
    refresh?: Partial<RefreshSettings>;
  };
  previousCache?: Readonly<Record<string, Partial<CacheEntry> | undefined>>;
  mode?: RefreshMode;
  /** At most this many sources are fetched per run; the rest is left for the next one. */
  maxSources?: number;
  now?: Date;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * A subscription is fetched at most once per this interval, whatever triggers the refresh.
 * Platforms may ask for longer (`refreshCooldownMs` in the registry) after a successful fetch.
 */
export const REFRESH_COOLDOWN_MS = 5 * MINUTE_MS;
/** Sources fetched per run. Large lists are worked through over several runs. */
export const MAX_SOURCES_PER_RUN = 100;
/** Finished sources between two progress reports (saves and sidebar updates). */
export const PROGRESS_EVERY = 25;
/** Longest wait before a failing source is tried again. */
export const MAX_FAILURE_BACKOFF_MS = DAY_MS;
/** Channels without uploads for this long are checked at most once a day. */
const INACTIVE_AFTER_MS = 30 * DAY_MS;
/** Channels without uploads for this long are checked half as often. */
const QUIET_AFTER_MS = 7 * DAY_MS;

export interface RefreshSummary {
  /** Enabled subscriptions, fetched or skipped. */
  total: number;
  /** Subscriptions that were fetched and failed. */
  failures: number;
  /** Subscriptions skipped because they are not due yet. */
  throttled: number;
  /** Due subscriptions left for a later run because of the per-run limit. */
  pending: number;
  /** Due subscriptions skipped because their host is paused or out of budget. */
  deferred: number;
  /** When the earliest skipped subscription may be fetched again; `null` if none was skipped. */
  nextRefreshAt: string | null;
  /** When the earliest deferred host may be asked again; `null` if nothing was deferred. */
  resumeAt: string | null;
  completedAt: string;
}

export interface RefreshResult extends RefreshSummary {
  cache: FeedCache;
}

export interface RefreshProgress {
  cache: FeedCache;
  /** Sources fetched (or attempted) so far in this run. */
  done: number;
  /** Sources this run will fetch. */
  planned: number;
}

/** Runs `worker` over `items` with at most `concurrency` in flight. */
async function runPool<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex] as T;
      nextIndex += 1;
      await worker(item);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, runWorker));
}

async function fetchSubscriptionItems(
  subscription: Subscription,
  dependencies: RefreshDependencies,
  feed: FeedSettings,
  apiKeys: Readonly<ApiKeys>
): Promise<FeedItem[]> {
  const items = await getPlatform(subscription.platform).adapter.fetchItems(subscription, {
    fetchText: dependencies.fetchText,
    fetchJson: dependencies.fetchJson,
    postJson: dependencies.postJson,
    timeoutMs: feed.timeoutMs,
    itemsPerSource: feed.itemsPerSource,
    apiKeys,
  });
  return items.toSorted(byPublishedDesc).slice(0, feed.itemsPerSource);
}

/** Failed fetches in a row; entries from before this field count one failure per error. */
function failuresOf(previous: Partial<CacheEntry> | undefined): number {
  return previous?.failures ?? (previous?.error ? 1 : 0);
}

/** Wait after a failure: 5 min, doubling with every failure in a row, up to a day. */
export function failureBackoffMs(failures: number): number {
  return Math.min(REFRESH_COOLDOWN_MS * 2 ** Math.max(0, failures - 1), MAX_FAILURE_BACKOFF_MS);
}

/** Newest publish time among cached items (ms), or `null` when nothing is dated. */
function newestUpload(items: readonly FeedItem[] | undefined): number | null {
  const times = (items ?? []).map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite);
  return times.length > 0 ? Math.max(...times) : null;
}

/**
 * Check interval for a subscription, stretched for channels that rarely upload: a channel
 * quiet for a week is checked half as often, one quiet for a month at most once a day.
 */
export function checkIntervalMs(
  intervalMs: number,
  items: readonly FeedItem[] | undefined,
  now: number
): number {
  const newest = newestUpload(items);
  if (newest === null) {
    return intervalMs;
  }
  const quietFor = now - newest;
  if (quietFor > INACTIVE_AFTER_MS) {
    return Math.max(intervalMs, DAY_MS);
  }
  if (quietFor > QUIET_AFTER_MS) {
    return 2 * intervalMs;
  }
  return intervalMs;
}

/**
 * Time (ms) from which `subscription` may be fetched again. `0` means "now, first": never
 * fetched, or waiting for host access the user may have just granted.
 */
export function dueAt(
  subscription: Subscription,
  previous: Partial<CacheEntry> | undefined,
  { mode, intervalMs, now }: { mode: RefreshMode; intervalMs: number; now: number }
): number {
  const fetchedAt = Date.parse(previous?.fetchedAt ?? "");
  if (!Number.isFinite(fetchedAt) || previous?.errorCode === "permission-required") {
    return 0;
  }
  if (previous?.error) {
    // A platform's longer cooldown only follows a success, so fixing a failure (e.g. adding a
    // missing API key) takes effect within the failure backoff.
    return fetchedAt + failureBackoffMs(failuresOf(previous));
  }

  const cooldown = getPlatform(subscription.platform).refreshCooldownMs ?? REFRESH_COOLDOWN_MS;
  const wait =
    mode === "manual"
      ? cooldown
      : Math.max(cooldown, checkIntervalMs(intervalMs, previous?.items, now));
  return fetchedAt + wait;
}

function keptEntry(previous: Partial<CacheEntry> | undefined): CacheEntry {
  const entry: CacheEntry = {
    fetchedAt: previous?.fetchedAt ?? "",
    items: previous?.items ?? [],
    error: previous?.error ?? null,
    errorCode: previous?.errorCode ?? "",
  };
  if (previous?.failures) {
    entry.failures = previous.failures;
  }
  return entry;
}

/** The `HostLimitError` behind `error`, also when an adapter wrapped it as the cause. */
function hostLimitIn(error: unknown): HostLimitError | null {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof HostLimitError) {
      return current;
    }
    current = current instanceof Error ? current.cause : null;
  }
  return null;
}

function earliest(times: readonly number[]): string | null {
  return times.length > 0 ? new Date(Math.min(...times)).toISOString() : null;
}

interface Candidate {
  subscription: Subscription;
  key: string;
  dueAt: number;
}

/**
 * Refreshes the enabled subscriptions that are due, oldest first, at most `maxSources` per run.
 * Failures never abort the run: each failed source keeps its previously cached items, records
 * an error code, and waits longer before the next try. The returned cache covers every enabled
 * subscription; sources not fetched in this run keep their entry as is.
 */
export async function refreshFeeds({
  subscriptions,
  settings,
  previousCache = {},
  mode = "due",
  maxSources = MAX_SOURCES_PER_RUN,
  now = new Date(),
  ...dependencies
}: RefreshFeedsOptions): Promise<RefreshResult> {
  const defaults = defaultSettings();
  const feed: FeedSettings = { ...defaults.feed, ...settings?.feed };
  const apiKeys: ApiKeys = { ...defaults.apiKeys, ...settings?.apiKeys };
  const intervalMs =
    (settings?.refresh?.intervalMinutes ?? defaults.refresh.intervalMinutes) * MINUTE_MS;
  const nowMs = now.getTime();
  const fetchedAt = now.toISOString();

  const enabled = subscriptions.filter((subscription) => subscription.enabled);
  const cache: FeedCache = {};
  const notDue: number[] = [];
  const blocked: number[] = [];
  const due: Candidate[] = [];

  for (const subscription of enabled) {
    const key = subscriptionKey(subscription);
    const previous = previousCache[key];
    cache[key] = keptEntry(previous);

    const at = dueAt(subscription, previous, { mode, intervalMs, now: nowMs });
    if (at > nowMs) {
      notDue.push(at);
      continue;
    }
    const blockedUntil = dependencies.hostBlockedUntil?.(subscription) ?? null;
    if (blockedUntil !== null) {
      blocked.push(blockedUntil);
      continue;
    }
    due.push({ subscription, key, dueAt: at });
  }

  // Never-fetched first, then the longest overdue.
  due.sort((left, right) => left.dueAt - right.dueAt);
  const planned = due.slice(0, Math.max(0, maxSources));

  let failures = 0;
  let done = 0;

  async function fetchOne({ subscription, key }: Candidate): Promise<void> {
    const previous = previousCache[key];
    const failed = (error: LocalizedText, errorCode: CacheEntry["errorCode"]): CacheEntry => {
      failures += 1;
      const entry: CacheEntry = { fetchedAt, items: previous?.items ?? [], error, errorCode };
      // Missing access is not the source's fault, so it does not grow the backoff.
      if (errorCode === "fetch-failed") {
        entry.failures = failuresOf(previous) + 1;
      }
      return entry;
    };

    try {
      if (!(await dependencies.checkPermission(subscription))) {
        cache[key] = failed({ id: "refresh-error-permission" }, "permission-required");
      } else {
        const items = await fetchSubscriptionItems(subscription, dependencies, feed, apiKeys);
        cache[key] = { fetchedAt, items, error: null, errorCode: "" };
      }
    } catch (error) {
      const hostLimit = hostLimitIn(error);
      if (hostLimit) {
        // Not this source's fault: keep the entry untouched and try again later.
        blocked.push(hostLimit.until);
      } else {
        cache[key] = failed(toLocalizedText(error, "refresh-error-generic"), "fetch-failed");
      }
    }

    done += 1;
    if (dependencies.onProgress && done % PROGRESS_EVERY === 0 && done < planned.length) {
      await dependencies.onProgress({ cache: { ...cache }, done, planned: planned.length });
    }
  }

  await runPool(planned, feed.concurrency, fetchOne);

  return {
    cache,
    total: enabled.length,
    failures,
    throttled: notDue.length,
    pending: due.length - planned.length,
    deferred: blocked.length,
    nextRefreshAt: earliest(notDue),
    resumeAt: earliest(blocked),
    completedAt: fetchedAt,
  };
}
