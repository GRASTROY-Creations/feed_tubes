import { errorMessage } from "./errors.js";
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
  Subscription,
} from "./types.js";

export interface RefreshDependencies {
  checkPermission: (subscription: Subscription) => Promise<boolean>;
  fetchText: FetchText;
  fetchJson: FetchJson;
  postJson: PostJson;
}

export interface RefreshFeedsOptions extends RefreshDependencies {
  subscriptions: readonly Subscription[];
  settings?: { feed?: Partial<FeedSettings>; apiKeys?: Partial<ApiKeys> };
  previousCache?: Readonly<Record<string, Partial<CacheEntry> | undefined>>;
  now?: Date;
}

/**
 * A subscription is fetched at most once per this interval, whatever triggers the refresh.
 * Platforms may ask for longer (`refreshCooldownMs` in the registry) after a successful fetch.
 */
export const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export interface RefreshSummary {
  /** Enabled subscriptions, fetched or skipped. */
  total: number;
  /** Subscriptions that were fetched and failed. */
  failures: number;
  /** Subscriptions skipped because they were fetched less than the cooldown ago. */
  throttled: number;
  /** When the earliest skipped subscription may be fetched again; `null` if none was skipped. */
  nextRefreshAt: string | null;
  completedAt: string;
}

export interface RefreshResult extends RefreshSummary {
  cache: FeedCache;
}

/** Runs `worker` over `items` with at most `concurrency` in flight, preserving order. */
async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex] as T);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
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

interface Outcome {
  key: string;
  entry: CacheEntry;
  /** Set when the subscription was skipped: the time (ms) it may be fetched again. */
  throttledUntil?: number;
}

/**
 * Time (ms) until which `previous` blocks a new fetch, or `null` when a fetch is allowed.
 * Entries that only failed for missing host access never block: the user may have just
 * granted it and expects the source to load right away.
 */
function cooldownUntil(
  subscription: Subscription,
  previous: Partial<CacheEntry> | undefined,
  now: number
): number | null {
  if (!previous?.fetchedAt || previous.errorCode === "permission-required") {
    return null;
  }
  // A platform's longer cooldown only follows a success, so fixing a failure (e.g. adding a
  // missing API key) takes effect within the normal cooldown.
  const cooldown = previous.error
    ? REFRESH_COOLDOWN_MS
    : (getPlatform(subscription.platform).refreshCooldownMs ?? REFRESH_COOLDOWN_MS);
  const until = Date.parse(previous.fetchedAt) + cooldown;
  return Number.isFinite(until) && until > now ? until : null;
}

function keptEntry(previous: Partial<CacheEntry>): CacheEntry {
  return {
    fetchedAt: previous.fetchedAt ?? "",
    items: previous.items ?? [],
    error: previous.error ?? "",
    errorCode: previous.errorCode ?? "",
  };
}

/**
 * Refreshes every enabled subscription. Failures never abort the run: each failed source
 * keeps its previously cached items and records an error code instead.
 *
 * Subscriptions fetched less than `REFRESH_COOLDOWN_MS` ago are not fetched again; their
 * cached entry is kept as is. This applies to manual, on-open, and alarm refreshes alike.
 */
export async function refreshFeeds({
  subscriptions,
  settings,
  previousCache = {},
  now = new Date(),
  ...dependencies
}: RefreshFeedsOptions): Promise<RefreshResult> {
  const feed: FeedSettings = { ...defaultSettings().feed, ...settings?.feed };
  const apiKeys: ApiKeys = { ...defaultSettings().apiKeys, ...settings?.apiKeys };
  const enabled = subscriptions.filter((subscription) => subscription.enabled);
  const fetchedAt = now.toISOString();

  const outcomes = await runPool(
    enabled,
    feed.concurrency,
    async (subscription): Promise<Outcome> => {
      const key = subscriptionKey(subscription);
      const previous = previousCache[key];

      const throttledUntil = cooldownUntil(subscription, previous, now.getTime());
      if (previous && throttledUntil !== null) {
        return { key, entry: keptEntry(previous), throttledUntil };
      }

      const failed = (error: string, errorCode: CacheEntry["errorCode"]): Outcome => ({
        key,
        entry: { fetchedAt, items: previous?.items ?? [], error, errorCode },
      });

      try {
        if (!(await dependencies.checkPermission(subscription))) {
          return failed("Host permission is required for this source.", "permission-required");
        }
        const items = await fetchSubscriptionItems(subscription, dependencies, feed, apiKeys);
        return { key, entry: { fetchedAt, items, error: "", errorCode: "" } };
      } catch (error) {
        return failed(errorMessage(error, "Could not refresh this source."), "fetch-failed");
      }
    }
  );

  const fetched = outcomes.filter((outcome) => outcome.throttledUntil === undefined);
  const throttledTimes = outcomes.flatMap((outcome) =>
    outcome.throttledUntil === undefined ? [] : [outcome.throttledUntil]
  );

  return {
    cache: Object.fromEntries(outcomes.map((outcome) => [outcome.key, outcome.entry])),
    failures: fetched.filter((outcome) => outcome.entry.error).length,
    throttled: throttledTimes.length,
    nextRefreshAt:
      throttledTimes.length > 0 ? new Date(Math.min(...throttledTimes)).toISOString() : null,
    total: enabled.length,
    completedAt: fetchedAt,
  };
}
