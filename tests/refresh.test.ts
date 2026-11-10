import { describe, expect, it } from "bun:test";
import { describeRefresh } from "../src/lib/refresh-report.js";
import { refreshFeeds } from "../src/lib/refresh.js";
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
    expect(entry.error).toContain("offline");
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
    let fetches = 0;
    const fail = () => {
      fetches += 1;
      return Promise.reject(new Error("fetched"));
    };
    const result = await refreshFeeds({
      subscriptions: [first, second],
      previousCache,
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
      error: "",
      errorCode: "" as const,
    };
    const { result, fetches } = await refreshWith({ [subscriptionKey(first)]: kept });

    expect(result.cache[subscriptionKey(first)]).toEqual(kept);
    expect(result.throttled).toBe(1);
    expect(result.total).toBe(2);
    expect(result.nextRefreshAt).toBe(new Date(NOW.getTime() + 3 * 60 * 1000).toISOString());
    // Only the second subscription was fetched (RSS, then the fallback API).
    expect(result.cache[subscriptionKey(second)]?.errorCode).toBe("fetch-failed");
    expect(fetches).toBe(2);
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
        error: "x",
        errorCode: "fetch-failed",
      },
      [subscriptionKey(second)]: {
        fetchedAt: minutesAgo(1),
        items: [],
        error: "x",
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
        error: "old",
        errorCode: "fetch-failed",
      },
    });

    expect(result.failures).toBe(1);
    expect(at(Object.values(result.cache), 0).error).toBe("old");
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
        "Refreshed 3 sources; 1 failed; 1 skipped (refreshed recently, next refresh in 4 min).",
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
