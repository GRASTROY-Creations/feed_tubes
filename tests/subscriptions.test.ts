import { describe, expect, it } from "bun:test";
import {
  dedupeSubscriptions,
  mergeSubscriptions,
  normalizeSubscription,
  subscriptionKey,
} from "../src/lib/subscriptions.js";
import { at, subscriptionOf } from "./fixtures.js";

describe("normalizeSubscription", () => {
  it("normalizes YouTube channel URLs", () => {
    const subscription = subscriptionOf({
      platform: "youtube",
      channelUrl: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/",
    });

    expect(subscription.channelId).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    expect(subscription.channelUrl).toBe(
      "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"
    );
    expect(subscription.enabled).toBe(true);
  });

  it("normalizes YouTube handles", () => {
    const subscription = subscriptionOf({ platform: "youtube", channelId: "@example" });

    expect(subscription.channelId).toBe("@example");
    expect(subscription.channelUrl).toBe("https://www.youtube.com/@example");
  });

  it("derives a PeerTube instance from a channel URL", () => {
    const subscription = subscriptionOf({
      platform: "peertube",
      channelUrl: "https://video.ploud.fr/c/science/videos",
    });

    expect(subscription.instanceUrl).toBe("https://video.ploud.fr");
    expect(subscription.channelId).toBe("science");
    expect(subscription.channelUrl).toBe("https://video.ploud.fr/c/science/videos");
  });

  it("requires a PeerTube instance", () => {
    const result = normalizeSubscription({ platform: "peertube", channelId: "science" });
    expect(result.errors).toContain("A PeerTube instance URL is required.");
  });

  it("requires a feed URL for bridge platforms", () => {
    const missing = normalizeSubscription({ platform: "bilibili", channelId: "2267573" });
    expect(missing.subscription).toBeNull();
    expect(missing.errors).toContain("This platform needs an RSS/Atom or bridge feed URL.");

    const valid = subscriptionOf({
      platform: "bilibili",
      channelId: "2267573",
      feedUrl: "https://rsshub.app/bilibili/user/video/2267573",
    });
    expect(valid.instanceUrl).toBe("https://rsshub.app");
  });

  it("parses textual and boolean enabled flags", () => {
    expect(subscriptionOf({ platform: "youtube", channelId: "@a", enabled: "off" }).enabled).toBe(
      false
    );
    expect(subscriptionOf({ platform: "youtube", channelId: "@a", enabled: false }).enabled).toBe(
      false
    );
    expect(subscriptionOf({ platform: "youtube", channelId: "@a", enabled: "" }).enabled).toBe(
      true
    );
  });

  it("rejects non-http schemes and credentialed URLs", () => {
    const script = normalizeSubscription({ platform: "generic", feedUrl: "javascript:alert(1)" });
    expect(script.subscription).toBeNull();
    expect(script.errors.length).toBeGreaterThan(0);

    const credentials = normalizeSubscription({
      platform: "generic",
      feedUrl: "https://user:pass@example.com/feed.xml",
    });
    expect(credentials.subscription).toBeNull();
  });

  it("rejects unknown platforms", () => {
    expect(normalizeSubscription({ platform: "myspace" }).errors).toEqual([
      "Unknown or missing platform.",
    ]);
  });
});

describe("subscriptionKey", () => {
  it("uses platform, host, channel, and feed", () => {
    const subscription = subscriptionOf({
      platform: "youtube",
      channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    });

    expect(subscriptionKey(subscription)).toBe("youtube|www.youtube.com|UC_x5XG1OV2P6uZZ5FSM9Ttw|");
  });
});

describe("subscription merging", () => {
  const first = subscriptionOf({
    platform: "youtube",
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    channelName: "First",
    enabled: false,
  });
  const duplicate = subscriptionOf({
    platform: "youtube",
    channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    channelName: "Updated",
    enabled: true,
  });
  const second = subscriptionOf({
    platform: "youtube",
    channelId: "UC1JTQBa5QxZCpXrFSkMxmPw",
    channelName: "Second",
  });

  it("deduplicates by key", () => {
    expect(dedupeSubscriptions([first, duplicate])).toHaveLength(1);
  });

  it("merges metadata while preserving existing enabled state", () => {
    const merged = mergeSubscriptions([first], [duplicate, second], "merge");

    expect(merged).toHaveLength(2);
    expect(at(merged, 0).channelName).toBe("Updated");
    expect(at(merged, 0).enabled).toBe(false);
  });

  it("skips duplicates and replaces when requested", () => {
    const skipped = mergeSubscriptions([first], [duplicate, second], "skip");
    expect(skipped).toHaveLength(2);
    expect(at(skipped, 0).channelName).toBe("First");

    const replaced = mergeSubscriptions([first], [second], "replace");
    expect(replaced).toHaveLength(1);
    expect(at(replaced, 0).channelName).toBe("Second");
  });
});
