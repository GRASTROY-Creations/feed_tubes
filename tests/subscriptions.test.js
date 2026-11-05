import { describe, expect, it } from "bun:test";
import {
  dedupeSubscriptions,
  mergeSubscriptions,
  normalizeSubscription,
  subscriptionKey,
} from "../src/lib/subscriptions.js";

describe("normalizeSubscription", () => {
  it("normalizes YouTube channel URLs", () => {
    const { subscription, errors } = normalizeSubscription({
      platform: "youtube",
      channelUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/",
    });

    expect(errors).toEqual([]);
    expect(subscription.channelId).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    expect(subscription.channelUrl).toBe(
      "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"
    );
    expect(subscription.enabled).toBe(true);
  });

  it("normalizes YouTube handles", () => {
    const { subscription, errors } = normalizeSubscription({
      platform: "youtube",
      channelId: "@example",
    });

    expect(errors).toEqual([]);
    expect(subscription.channelId).toBe("@example");
    expect(subscription.channelUrl).toBe("https://www.youtube.com/@example");
  });

  it("derives a PeerTube instance from a channel URL", () => {
    const { subscription, errors } = normalizeSubscription({
      platform: "peertube",
      channelUrl: "https://video.ploud.fr/c/science/videos",
    });

    expect(errors).toEqual([]);
    expect(subscription.instanceUrl).toBe("https://video.ploud.fr");
    expect(subscription.channelId).toBe("science");
    expect(subscription.channelUrl).toBe("https://video.ploud.fr/c/science/videos");
  });

  it("requires a feed URL for bridge platforms", () => {
    const missing = normalizeSubscription({
      platform: "bilibili",
      channelId: "2267573",
    });
    expect(missing.subscription).toBeNull();
    expect(missing.errors).toContain("This platform needs an RSS/Atom or bridge feed URL.");

    const valid = normalizeSubscription({
      platform: "bilibili",
      channelId: "2267573",
      feedUrl: "https://rsshub.app/bilibili/user/video/2267573",
    });
    expect(valid.errors).toEqual([]);
    expect(valid.subscription.instanceUrl).toBe("https://rsshub.app");
  });

  it("rejects non-http schemes and credentialed URLs", () => {
    const script = normalizeSubscription({
      platform: "generic",
      feedUrl: "javascript:alert(1)",
    });
    expect(script.subscription).toBeNull();
    expect(script.errors.length).toBeGreaterThan(0);

    const credentials = normalizeSubscription({
      platform: "generic",
      feedUrl: "https://user:pass@example.com/feed.xml",
    });
    expect(credentials.subscription).toBeNull();
  });
});

describe("subscriptionKey", () => {
  it("uses platform, host, channel, and feed", () => {
    const { subscription } = normalizeSubscription({
      platform: "youtube",
      channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    });

    expect(subscriptionKey(subscription)).toBe("youtube|www.youtube.com|UC_x5XG1OV2P6uZZ5FSM9Ttw|");
  });
});

describe("subscription merging", () => {
  const first = normalizeSubscription({
    platform: "youtube",
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    channelName: "First",
    enabled: false,
  }).subscription;
  const duplicate = normalizeSubscription({
    platform: "youtube",
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    channelName: "Updated",
    enabled: true,
  }).subscription;
  const second = normalizeSubscription({
    platform: "youtube",
    channelId: "UC1JTQBa5QxZCpXrFSkMxmPw",
    channelName: "Second",
  }).subscription;

  it("deduplicates by key", () => {
    expect(dedupeSubscriptions([first, duplicate])).toHaveLength(1);
  });

  it("merges metadata while preserving existing enabled state", () => {
    const merged = mergeSubscriptions([first], [duplicate, second], "merge");

    expect(merged).toHaveLength(2);
    expect(merged[0].channelName).toBe("Updated");
    expect(merged[0].enabled).toBe(false);
  });

  it("skips duplicates and replaces when requested", () => {
    const skipped = mergeSubscriptions([first], [duplicate, second], "skip");
    expect(skipped).toHaveLength(2);
    expect(skipped[0].channelName).toBe("First");

    const replaced = mergeSubscriptions([first], [second], "replace");
    expect(replaced).toHaveLength(1);
    expect(replaced[0].channelName).toBe("Second");
  });
});
