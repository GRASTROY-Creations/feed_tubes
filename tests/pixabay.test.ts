import { describe, expect, it } from "bun:test";
import { HttpError, NetworkError, redactUrl } from "../src/lib/errors.js";
import {
  parsePixabayUser,
  pixabayAdapter,
  uploadDateFromCdnUrl,
} from "../src/lib/platforms/pixabay.js";
import { refreshFeeds } from "../src/lib/refresh.js";
import { formatWait } from "../src/lib/refresh-report.js";
import { subscriptionKey } from "../src/lib/subscriptions.js";
import type { AdapterContext } from "../src/lib/types.js";
import { apiKeys, at, rejectionOf, subscriptionOf } from "./fixtures.js";

const KEY = "12345678-abcdefabcdefabcdefabcdef0";

/** One hit in the shape of https://pixabay.com/api/docs/#api_search_videos. */
function hit(id: number, user: string, userId: number): Record<string, unknown> {
  return {
    id,
    pageURL: `https://pixabay.com/videos/flowers-yellow-${id}/`,
    tags: "flowers, yellow, blossom",
    videos: {
      small: {
        url: `https://cdn.pixabay.com/video/2015/08/08/${id}-135736646_small.mp4`,
        thumbnail: `https://cdn.pixabay.com/video/2015/08/08/${id}-135736646_small.jpg`,
      },
    },
    user_id: userId,
    user,
  };
}

function fakeApi(hits: unknown[], apiKey = KEY): { context: AdapterContext; requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    context: {
      fetchJson: (url) => {
        requested.push(url);
        return Promise.resolve({ total: hits.length, totalHits: hits.length, hits });
      },
      fetchText: () => Promise.reject(new Error("unused")),
      postJson: () => Promise.reject(new Error("unused")),
      timeoutMs: 1000,
      itemsPerSource: 5,
      apiKeys: apiKeys({ pixabay: apiKey }),
    },
  };
}

const coverr = subscriptionOf({
  platform: "pixabay",
  channelUrl: "https://pixabay.com/users/coverr-free-footage-1281706/",
});

describe("Pixabay subscriptions", () => {
  it("stores the profile slug from a profile URL", () => {
    expect(coverr.channelId).toBe("coverr-free-footage-1281706");
    // Channel URLs are stored without a trailing slash, like on every platform.
    expect(coverr.channelUrl).toBe("https://pixabay.com/users/coverr-free-footage-1281706");
  });

  it("accepts a plain contributor name and localized profile URLs", () => {
    expect(
      subscriptionOf({ platform: "pixabay", channelId: "Coverr-Free-Footage" }).channelId
    ).toBe("Coverr-Free-Footage");
    expect(
      subscriptionOf({
        platform: "pixabay",
        channelUrl: "https://pixabay.com/de/users/someone-42/",
      }).channelId
    ).toBe("someone-42");
  });

  it("splits a slug into name and numeric id", () => {
    expect(parsePixabayUser("coverr-free-footage-1281706")).toEqual({
      name: "coverr-free-footage",
      id: 1281706,
    });
    expect(parsePixabayUser("Coverr-Free-Footage")).toEqual({
      name: "Coverr-Free-Footage",
      id: null,
    });
  });
});

describe("Pixabay upload dates", () => {
  it("reads the upload day from the CDN path", () => {
    expect(uploadDateFromCdnUrl("https://cdn.pixabay.com/video/2015/08/08/125-1_small.jpg")).toBe(
      "2015-08-08T00:00:00.000Z"
    );
    expect(uploadDateFromCdnUrl("https://example.com/thumb.jpg")).toBe("");
  });
});

describe("pixabayAdapter", () => {
  it("searches the contributor's latest videos and keeps only theirs", async () => {
    const { context, requested } = fakeApi([
      hit(125, "Coverr-Free-Footage", 1281706),
      hit(999, "Someone-Else", 7),
    ]);
    const items = await pixabayAdapter.fetchItems(coverr, context);

    const url = new URL(at(requested, 0));
    expect(`${url.origin}${url.pathname}`).toBe("https://pixabay.com/api/videos/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: KEY,
      q: "user:coverr-free-footage",
      order: "latest",
      per_page: "5",
    });
    expect(items).toHaveLength(1);
    expect(at(items, 0)).toMatchObject({
      id: "pixabay:125",
      title: "Flowers, yellow, blossom",
      url: "https://pixabay.com/videos/flowers-yellow-125/",
      publishedAt: "2015-08-08T00:00:00.000Z",
      channelName: "Coverr-Free-Footage",
    });
  });

  it("matches by name when the subscription has no numeric id", async () => {
    const { context } = fakeApi([hit(1, "coverr-free-footage", 1281706)]);
    const items = await pixabayAdapter.fetchItems(
      subscriptionOf({ platform: "pixabay", channelId: "Coverr-Free-Footage" }),
      context
    );
    expect(items).toHaveLength(1);
  });

  it("explains a missing API key", async () => {
    const { context, requested } = fakeApi([], "");
    const error = await rejectionOf(pixabayAdapter.fetchItems(coverr, context));
    expect(error.message).toBe(
      "Add your Pixabay API key in Settings → General to load Pixabay videos."
    );
    expect(requested).toHaveLength(0);
  });

  it("reports when none of the results are from the contributor", async () => {
    const { context } = fakeApi([hit(999, "Someone-Else", 7)]);
    const error = await rejectionOf(pixabayAdapter.fetchItems(coverr, context));
    expect(error.message).toBe('Pixabay returned no videos from "coverr-free-footage".');
  });
});

describe("API keys in error messages", () => {
  const url = `https://pixabay.com/api/videos/?key=${KEY}&q=user%3Ax`;

  it("redacts credential parameters", () => {
    expect(redactUrl(url)).toBe("https://pixabay.com/api/videos/?key=***&q=user%3Ax");
    expect(redactUrl("https://example.com/feed?page=2")).toBe("https://example.com/feed?page=2");
  });

  it("never puts the key into HTTP or network errors", () => {
    expect(new HttpError(400, url).message).not.toContain(KEY);
    expect(new NetworkError(url, new TypeError("offline")).message).not.toContain(KEY);
  });
});

describe("Pixabay refresh cooldown", () => {
  const NOW = new Date("2026-11-10T12:00:00Z");
  const hoursAgo = (hours: number): string =>
    new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

  async function refreshWith(entry: { fetchedAt: string; error?: string }) {
    let fetches = 0;
    const result = await refreshFeeds({
      subscriptions: [coverr],
      settings: { apiKeys: { pixabay: KEY } },
      previousCache: {
        [subscriptionKey(coverr)]: {
          items: [],
          error: entry.error ?? "",
          errorCode: entry.error ? "fetch-failed" : "",
          fetchedAt: entry.fetchedAt,
        },
      },
      now: NOW,
      checkPermission: () => Promise.resolve(true),
      fetchJson: () => {
        fetches += 1;
        return Promise.resolve({ hits: [hit(125, "Coverr-Free-Footage", 1281706)] });
      },
      fetchText: () => Promise.reject(new Error("unused")),
      postJson: () => Promise.reject(new Error("unused")),
    });
    return { result, fetches };
  }

  it("waits 24 hours after a successful fetch", async () => {
    const { result, fetches } = await refreshWith({ fetchedAt: hoursAgo(2) });
    expect(fetches).toBe(0);
    expect(result.throttled).toBe(1);
    expect(formatWait(result.nextRefreshAt, NOW)).toBe("22 h");
  });

  it("fetches again after 24 hours", async () => {
    const { fetches } = await refreshWith({ fetchedAt: hoursAgo(25) });
    expect(fetches).toBe(1);
  });

  it("retries a failed fetch after the normal short cooldown", async () => {
    const { fetches } = await refreshWith({ fetchedAt: hoursAgo(1), error: "no key" });
    expect(fetches).toBe(1);
  });
});
