import { describe, expect, it } from "bun:test";
import { dtubeAdapter, dtubeShortId, dtubeWatchUrl } from "../src/lib/platforms/dtube.js";
import { normalizeSubscription } from "../src/lib/subscriptions.js";
import type { AdapterContext } from "../src/lib/types.js";
import { at, rejectionOf, subscriptionOf } from "./fixtures.js";

const CHANNEL_UUID = "0d0169f9-bd3f-44c7-9c3b-d0ebd7d99e58";
const VIDEO_UUID = "fbd5a9c6-fe08-4308-81a6-d6d8951fe7fb";

/** Answers like api.d.tube, recording every URL requested. */
function fakeApi(channel: unknown = { id: CHANNEL_UUID, username: "styles" }): {
  context: AdapterContext;
  requested: string[];
} {
  const requested: string[] = [];
  const fetchJson = (url: string): Promise<unknown> => {
    requested.push(url);
    if (url.includes("/channels/")) {
      return Promise.resolve(channel);
    }
    return Promise.resolve([
      {
        id: VIDEO_UUID,
        title: "Styles - Mafia Of Monsters(Official Music Video)",
        thumbnail_url: `https://nas1.d.tube/frames/${VIDEO_UUID}/1.jpg`,
        created_at: "2026-11-05T23:10:37.172Z",
        user: { id: CHANNEL_UUID, username: "styles" },
      },
      { id: "not-a-uuid", title: "Broken entry" },
    ]);
  };
  return {
    requested,
    context: {
      fetchJson,
      fetchText: () => Promise.reject(new Error("unused")),
      postJson: () => Promise.reject(new Error("unused")),
      timeoutMs: 1000,
      itemsPerSource: 5,
      apiKeys: { pixabay: "" },
    },
  };
}

describe("D.Tube URLs", () => {
  it("writes video UUIDs as the base58 ids d.tube uses in watch URLs", () => {
    // Matches the link on https://d.tube/channel/styles.
    expect(dtubeShortId(VIDEO_UUID)).toBe("Y6fNR7jS5j9QyzvQJPGQ66");
    expect(dtubeWatchUrl(VIDEO_UUID)).toBe("https://d.tube/watch/Y6fNR7jS5j9QyzvQJPGQ66");
    expect(dtubeWatchUrl("nope")).toBe("");
  });
});

describe("D.Tube subscriptions", () => {
  it("accepts a name, an @name, or a channel URL", () => {
    for (const input of ["styles", "@styles", "https://d.tube/channel/styles/videos"]) {
      const subscription = subscriptionOf({ platform: "dtube", channelId: input });
      expect(subscription.channelId).toBe("styles");
      expect(subscription.channelUrl).toBe("https://d.tube/channel/styles");
      expect(subscription.instanceUrl).toBe("https://d.tube");
    }
  });

  it("rejects a d.tube URL that is not a channel", () => {
    const result = normalizeSubscription({
      platform: "dtube",
      channelUrl: "https://d.tube/watch/Y6fNR7jS5j9QyzvQJPGQ66",
    });
    expect(result.errors).toContain("A channel ID or channel URL is required.");
  });
});

describe("dtubeAdapter", () => {
  it("looks up the channel id, then lists its newest videos", async () => {
    const { context, requested } = fakeApi();
    const items = await dtubeAdapter.fetchItems(
      subscriptionOf({ platform: "dtube", channelId: "styles" }),
      context
    );

    expect(requested).toEqual([
      "https://api.d.tube/channels/styles",
      `https://api.d.tube/videos?channel=${CHANNEL_UUID}&limit=5`,
    ]);
    expect(items).toHaveLength(1);
    expect(at(items, 0)).toMatchObject({
      id: `dtube:${VIDEO_UUID}`,
      url: "https://d.tube/watch/Y6fNR7jS5j9QyzvQJPGQ66",
      publishedAt: "2026-11-05T23:10:37.172Z",
      channelName: "styles",
    });
  });

  it("reports unknown channels clearly", async () => {
    const { context } = fakeApi({ message: "Channel not found" });
    const error = await rejectionOf(
      dtubeAdapter.fetchItems(subscriptionOf({ platform: "dtube", channelId: "nobody" }), context)
    );
    expect(error.message).toBe('D.Tube has no channel named "nobody".');
  });
});
