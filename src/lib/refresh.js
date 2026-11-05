import { getAdapter } from "./platforms/registry.js";
import { subscriptionKey } from "./subscriptions.js";
import { DEFAULT_SETTINGS } from "./storage.js";

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () =>
    runWorker()
  );
  await Promise.all(workers);
  return results;
}

function sortItems(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt || "") || 0;
    const rightTime = Date.parse(right.publishedAt || "") || 0;
    return rightTime - leftTime;
  });
}

export async function refreshSubscription(subscription, context) {
  if (!(await context.checkPermission(subscription))) {
    return {
      error: "Host permission is required for this source.",
      errorCode: "permission-required",
    };
  }

  const adapter = getAdapter(subscription.platform);
  const items = await adapter.fetchItems(subscription, {
    fetchText: context.fetchText,
    fetchJson: context.fetchJson,
    timeoutMs: context.timeoutMs,
    itemsPerSource: context.itemsPerSource,
  });

  return {
    items: sortItems(items).slice(0, context.itemsPerSource),
    error: "",
    errorCode: "",
  };
}

export async function refreshFeeds({
  subscriptions,
  settings,
  previousCache = {},
  checkPermission,
  fetchText,
  fetchJson,
  now = new Date(),
}) {
  const feedSettings = { ...DEFAULT_SETTINGS.feed, ...(settings?.feed || {}) };
  const enabled = subscriptions.filter((subscription) => subscription.enabled);
  const timestamp = now.toISOString();

  const results = await runPool(enabled, feedSettings.concurrency, async (subscription) => {
    const key = subscriptionKey(subscription);
    const previous = previousCache[key];

    try {
      const result = await refreshSubscription(subscription, {
        checkPermission,
        fetchText,
        fetchJson,
        timeoutMs: feedSettings.timeoutMs,
        itemsPerSource: feedSettings.itemsPerSource,
      });

      return [
        key,
        {
          fetchedAt: timestamp,
          items: result.items || previous?.items || [],
          error: result.error || "",
          errorCode: result.errorCode || "",
        },
      ];
    } catch (error) {
      return [
        key,
        {
          fetchedAt: timestamp,
          items: previous?.items || [],
          error: error?.message || "Could not refresh this source.",
          errorCode: "fetch-failed",
        },
      ];
    }
  });

  const cache = Object.fromEntries(results);
  const failures = Object.values(cache).filter((entry) => entry.error).length;

  return {
    cache,
    failures,
    total: enabled.length,
    completedAt: timestamp,
  };
}
