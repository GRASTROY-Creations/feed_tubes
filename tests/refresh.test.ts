import { describe, expect, it } from "bun:test";
import { translate } from "../src/lib/i18n/index.js";
import { describeRefresh } from "../src/lib/refresh-report.js";
import { resetClientVersion } from "../src/lib/platforms/youtube-innertube.js";
import { HostLimitError } from "../src/lib/errors.js";
import {
  checkIntervalMs,
  failureBackoffMs,
  MAX_FAILURE_BACKOFF_MS,
  PROGRESS_EVERY,
  refreshFeeds,
} from "../src/lib/refresh.js";
import { subscriptionKey } from "../src/lib/subscriptions.js";
import { at, feedItem, subscriptionOf } from "./fixtures.js";

const fetchNothing = {
  fetchText: () => Promise.resolve(""),
  fetchJson: () => Promise.resolve({}),
  postJson: () => Promise.resolve({}),
};

describe("refreshFeeds", () => {
  const subscription = subscriptionOf({
    platform: "youtube",
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    channelName: "Example",
    enabled: true,
  });

  it("reports permission failures and preserves cached items", async () => {
    const result = await refreshFeeds({
      subscriptions: [subscription],
      settings: { feed: { concurrency: 1 } },
      previousCache: {
        [subscriptionKey(subscription)]: { items: [feedItem({ id: "old" })] },
      },
      checkPermission: () => Promise.resolve(false),
      ...fetchNothing,
    });

    const entry = at(Object.values(result.cache), 0);
    expect(result.failures).toBe(1);
    expect(result.total).toBe(1);
    expect(entry.errorCode).toBe("permission-required");
    expect(entry.items).toHaveLength(1);
  });

  it("records adapter errors as fetch failures", async () => {
    const result = await refreshFeeds({
      subscriptions: [subscription],
      checkPermission: () => Promise.resolve(true),
      fetchText: () => Promise.reject(new Error("offline")),
      fetchJson: () => Promise.resolve({}),
      postJson: () => Promise.reject(new Error("offline")),
    });

    const entry = at(Object.values(result.cache), 0);
    expect(entry.errorCode).toBe("fetch-failed");
    // Stored as a message id; errors from outside FeedTubes keep their own text, as data.
    expect(entry.error?.id).toBe("youtube-both-failed");
    expect(translate(entry.error ?? { id: "error-raw" })).toContain("offline");
  });

  it("ignores disabled subscriptions", async () => {
    const result = await refreshFeeds({
      subscriptions: [{ ...subscription, enabled: false }],
      settings: {},
      checkPermission: () => Promise.resolve(true),
      ...fetchNothing,
    });

    expect(result.total).toBe(0);
    expect(result.cache).toEqual({});
  });
});

describe("refresh cooldown", () => {
  const NOW = new Date("2026-11-06T12:00:00Z");
  const minutesAgo = (minutes: number): string =>
    new Date(NOW.getTime() - minutes * 60 * 1000).toISOString();

  const first = subscriptionOf({ platform: "youtube", channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw" });
  const second = subscriptionOf({ platform: "youtube", channelId: "UC1JTQBa5QxZCpXrFSkMxmPw" });

  /** Runs a refresh where every fetch fails with "fetched", counting the fetch attempts. */
  async function refreshWith(previousCache: Parameters<typeof refreshFeeds>[0]["previousCache"]) {
    resetClientVersion();
    let fetches = 0;
    const fail = () => {
      fetches += 1;
      return Promise.reject(new Error("fetched"));
    };
    const result = await refreshFeeds({
      subscriptions: [first, second],
      previousCache,
      // The button: only the short cooldown applies, not the check interval.
      mode: "manual",
      now: NOW,
      checkPermission: () => Promise.resolve(true),
      fetchText: fail,
      fetchJson: fail,
      postJson: fail,
    });
    return { result, fetches };
  }

  it("skips subscriptions fetched less than 5 minutes ago and keeps their cache", async () => {
    const kept = {
      fetchedAt: minutesAgo(2),
      items: [feedItem({ id: "kept" })],
      error: null,
      errorCode: "" as const,
    };
    const { result, fetches } = await refreshWith({ [subscriptionKey(first)]: kept });

    expect(result.cache[subscriptionKey(first)]).toEqual(kept);
    expect(result.throttled).toBe(1);
    expect(result.total).toBe(2);
    expect(result.nextRefreshAt).toBe(new Date(NOW.getTime() + 3 * 60 * 1000).toISOString());
    // Only the second subscription was fetched: RSS, the client version lookup, the fallback API.
    expect(result.cache[subscriptionKey(second)]?.errorCode).toBe("fetch-failed");
    expect(fetches).toBe(3);
  });

  it("fetches again once 5 minutes have passed", async () => {
    const { result } = await refreshWith({
      [subscriptionKey(first)]: { fetchedAt: minutesAgo(5), items: [] },
      [subscriptionKey(second)]: { fetchedAt: minutesAgo(30), items: [] },
    });

    expect(result.throttled).toBe(0);
    expect(result.nextRefreshAt).toBeNull();
  });

  it("throttles failed fetches too, but never sources waiting for host access", async () => {
    const { result } = await refreshWith({
      [subscriptionKey(first)]: {
        fetchedAt: minutesAgo(1),
        items: [],
        error: { id: "refresh-error-generic" as const },
        errorCode: "fetch-failed",
      },
      [subscriptionKey(second)]: {
        fetchedAt: minutesAgo(1),
        items: [],
        error: { id: "refresh-error-permission" as const },
        errorCode: "permission-required",
      },
    });

    expect(result.throttled).toBe(1);
    expect(result.cache[subscriptionKey(second)]?.fetchedAt).toBe(NOW.toISOString());
  });

  it("counts only fetched sources as failures", async () => {
    const { result } = await refreshWith({
      [subscriptionKey(first)]: {
        fetchedAt: minutesAgo(1),
        items: [],
        error: { id: "refresh-error-generic" },
        errorCode: "fetch-failed",
      },
    });

    expect(result.failures).toBe(1);
    expect(at(Object.values(result.cache), 0).error).toEqual({ id: "refresh-error-generic" });
  });
});

describe("describeRefresh", () => {
  const NOW = new Date("2026-11-06T12:00:00Z");
  const inMinutes = (minutes: number): string =>
    new Date(NOW.getTime() + minutes * 60 * 1000).toISOString();

  it("explains when every source is still cooling down", () => {
    expect(
      describeRefresh({ total: 2, failures: 0, throttled: 2, nextRefreshAt: inMinutes(2.5) }, NOW)
    ).toEqual({
      message: "All sources were refreshed recently; next refresh in 3 min.",
      error: false,
    });
  });

  it("mentions skipped and failed sources", () => {
    expect(
      describeRefresh({ total: 4, failures: 1, throttled: 1, nextRefreshAt: inMinutes(4) }, NOW)
    ).toEqual({
      message:
        "Refreshed 3 sources, 1 failed, and 1 skipped (refreshed recently, next refresh in 4 min).",
      error: true,
    });
  });

  it("keeps the plain messages when nothing was skipped", () => {
    expect(
      describeRefresh({ total: 1, failures: 0, throttled: 0, nextRefreshAt: null }, NOW)
    ).toEqual({
      message: "Refreshed 1 source.",
      error: false,
    });
    expect(
      describeRefresh({ total: 0, failures: 0, throttled: 0, nextRefreshAt: null }, NOW).message
    ).toBe("Add an enabled subscription before refreshing.");
  });
});

describe("due selection and batches", () => {
  const NOW = new Date("2026-11-06T12:00:00Z");
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const ago = (milliseconds: number): string =>
    new Date(NOW.getTime() - milliseconds).toISOString();
  const channel = (index: number) =>
    subscriptionOf({
      platform: "youtube",
      channelId: `UC${String(index).padStart(22, "0")}`,
      enabled: true,
    });
  const uploadedAgo = (milliseconds: number) => [
    feedItem({ id: "latest", platform: "youtube", publishedAt: ago(milliseconds) }),
  ];

  /** One video in the InnerTube "Videos" tab format. */
  const videosTab = {
    contents: { videoRenderer: { videoId: "v1", title: { simpleText: "Video" } } },
  };

  /**
   * Refreshes where every source loads one video. The RSS step has no `DOMParser` under
   * `bun test`, so each source loads through the fallback API; `fetchedUrls` lists the feed
   * URLs that were asked for, one per fetched source.
   */
  async function run(
    options: Partial<Parameters<typeof refreshFeeds>[0]> & {
      subscriptions: Parameters<typeof refreshFeeds>[0]["subscriptions"];
    }
  ) {
    const fetchedUrls: string[] = [];
    const result = await refreshFeeds({
      now: NOW,
      settings: { refresh: { intervalMinutes: 180 } },
      checkPermission: () => Promise.resolve(true),
      fetchText: (url) => {
        if (url.includes("/feeds/")) {
          fetchedUrls.push(url);
        }
        return Promise.resolve("");
      },
      fetchJson: () => Promise.resolve({}),
      postJson: () => Promise.resolve(videosTab),
      ...options,
    });
    return { result, fetchedUrls };
  }

  it("fetches only subscriptions whose check interval has passed", async () => {
    const recent = channel(1);
    const stale = channel(2);
    const { result, fetchedUrls } = await run({
      subscriptions: [recent, stale],
      previousCache: {
        [subscriptionKey(recent)]: { fetchedAt: ago(HOUR), items: uploadedAgo(HOUR) },
        [subscriptionKey(stale)]: { fetchedAt: ago(4 * HOUR), items: uploadedAgo(HOUR) },
      },
    });

    expect(fetchedUrls).toHaveLength(1);
    expect(fetchedUrls[0]).toContain(stale.channelId);
    expect(result.throttled).toBe(1);
    expect(result.nextRefreshAt).toBe(new Date(NOW.getTime() + 2 * HOUR).toISOString());
  });

  it("checks inactive channels at most once a day", () => {
    expect(checkIntervalMs(3 * HOUR, uploadedAgo(HOUR), NOW.getTime())).toBe(3 * HOUR);
    expect(checkIntervalMs(3 * HOUR, uploadedAgo(10 * DAY), NOW.getTime())).toBe(6 * HOUR);
    expect(checkIntervalMs(3 * HOUR, uploadedAgo(60 * DAY), NOW.getTime())).toBe(DAY);
    expect(checkIntervalMs(3 * HOUR, [], NOW.getTime())).toBe(3 * HOUR);
  });

  it("fetches at most maxSources per run, never-fetched first, and reports the rest", async () => {
    const old = channel(1);
    const fresh = [channel(2), channel(3), channel(4)];
    const { result, fetchedUrls } = await run({
      subscriptions: [old, ...fresh],
      previousCache: { [subscriptionKey(old)]: { fetchedAt: ago(DAY), items: [] } },
      maxSources: 2,
    });

    expect(fetchedUrls).toHaveLength(2);
    expect(fetchedUrls.some((url) => url.includes(old.channelId))).toBe(false);
    expect(result.pending).toBe(2);
    expect(result.failures).toBe(0);
    // Sources left for later keep a cache entry.
    expect(Object.keys(result.cache)).toHaveLength(4);
  });

  it("waits longer after each failure in a row", async () => {
    expect(failureBackoffMs(1)).toBe(5 * 60 * 1000);
    expect(failureBackoffMs(3)).toBe(20 * 60 * 1000);
    expect(failureBackoffMs(30)).toBe(MAX_FAILURE_BACKOFF_MS);

    const failing = channel(1);
    const entry = (fetchedMinutesAgo: number) => ({
      fetchedAt: ago(fetchedMinutesAgo * 60 * 1000),
      items: [],
      error: { id: "refresh-error-generic" as const },
      errorCode: "fetch-failed" as const,
      failures: 3,
    });

    const waiting = await run({
      subscriptions: [failing],
      previousCache: { [subscriptionKey(failing)]: entry(15) },
      mode: "manual",
    });
    expect(waiting.fetchedUrls).toHaveLength(0);

    const retried = await run({
      subscriptions: [failing],
      previousCache: { [subscriptionKey(failing)]: entry(25) },
      fetchText: () => Promise.reject(new Error("still down")),
      postJson: () => Promise.reject(new Error("still down")),
    });
    expect(retried.result.cache[subscriptionKey(failing)]?.failures).toBe(4);
  });

  it("clears the failure count after a success", async () => {
    const recovered = channel(1);
    const { result } = await run({
      subscriptions: [recovered],
      previousCache: {
        [subscriptionKey(recovered)]: {
          fetchedAt: ago(DAY),
          items: [],
          error: { id: "refresh-error-generic" },
          errorCode: "fetch-failed",
          failures: 2,
        },
      },
    });
    expect(result.cache[subscriptionKey(recovered)]).toMatchObject({ error: null });
    expect(result.cache[subscriptionKey(recovered)]?.failures).toBeUndefined();
  });

  it("defers sources of a blocked host without a request or a failure", async () => {
    const blocked = channel(1);
    const until = NOW.getTime() + HOUR;
    const kept = {
      fetchedAt: ago(DAY),
      items: [feedItem({ id: "kept" })],
      error: null,
      errorCode: "" as const,
    };
    const { result, fetchedUrls } = await run({
      subscriptions: [blocked, channel(2)],
      previousCache: { [subscriptionKey(blocked)]: kept },
      hostBlockedUntil: (subscription) => (subscription === blocked ? until : null),
    });

    expect(fetchedUrls).toHaveLength(1);
    expect(result.deferred).toBe(1);
    expect(result.failures).toBe(0);
    expect(result.resumeAt).toBe(new Date(until).toISOString());
    expect(result.cache[subscriptionKey(blocked)]).toEqual(kept);
  });

  it("treats a host limit hit during the run as deferred, not failed", async () => {
    const source = channel(1);
    const { result } = await run({
      subscriptions: [source],
      fetchText: () =>
        Promise.reject(new HostLimitError("budget", "www.youtube.com", NOW.getTime() + HOUR)),
    });

    expect(result.failures).toBe(0);
    expect(result.deferred).toBe(1);
    expect(result.cache[subscriptionKey(source)]?.fetchedAt).toBe("");
  });

  it("reports progress every PROGRESS_EVERY sources", async () => {
    const subscriptions = Array.from({ length: PROGRESS_EVERY * 2 + 3 }, (_, index) =>
      channel(index)
    );
    const reports: number[] = [];
    await run({
      subscriptions,
      onProgress: ({ done, cache }) => {
        reports.push(done);
        expect(Object.keys(cache)).toHaveLength(subscriptions.length);
      },
    });
    expect(reports).toEqual([PROGRESS_EVERY, PROGRESS_EVERY * 2]);
  });
});

describe("describeRefresh with queued sources", () => {
  it("mentions sources left for later batches", () => {
    expect(
      describeRefresh({
        total: 300,
        failures: 0,
        throttled: 0,
        pending: 200,
        deferred: 0,
        nextRefreshAt: null,
      }).message
    ).toBe("Refreshed 100 sources and 200 queued for the next batches.");
  });
});
