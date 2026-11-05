import { describe, expect, it } from "bun:test";
import { refreshFeeds } from "../src/lib/refresh.js";
import { normalizeSubscription, subscriptionKey } from "../src/lib/subscriptions.js";

describe("refreshFeeds", () => {
  const subscription = normalizeSubscription({
    platform: "youtube",
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    channelName: "Example",
    enabled: true,
  }).subscription;

  it("reports permission failures and preserves cached items", async () => {
    const result = await refreshFeeds({
      subscriptions: [subscription],
      settings: { feed: { concurrency: 1 } },
      previousCache: {
        [subscriptionKey(subscription)]: {
          items: [{ id: "old", title: "Old", url: "https://example.com/old" }],
        },
      },
      checkPermission: async () => false,
      fetchText: async () => "",
      fetchJson: async () => ({}),
    });

    const entry = Object.values(result.cache)[0];
    expect(result.failures).toBe(1);
    expect(result.total).toBe(1);
    expect(entry.errorCode).toBe("permission-required");
    expect(entry.items).toHaveLength(1);
  });

  it("ignores disabled subscriptions", async () => {
    const result = await refreshFeeds({
      subscriptions: [{ ...subscription, enabled: false }],
      settings: {},
      checkPermission: async () => true,
      fetchText: async () => "",
      fetchJson: async () => ({}),
    });

    expect(result.total).toBe(0);
    expect(result.cache).toEqual({});
  });
});
