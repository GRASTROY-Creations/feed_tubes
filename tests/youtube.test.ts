import { describe, expect, it } from "bun:test";
import { parseChannelVideos, parseRelativeAge } from "../src/lib/platforms/youtube-innertube.js";
import {
  needsYouTubeLookup,
  toYouTubeHandle,
  youtubeChannelPageUrl,
} from "../src/lib/platforms/youtube-urls.js";
import { resolveYouTubeChannel, youtubeAdapter } from "../src/lib/platforms/youtube.js";
import type { AdapterContext } from "../src/lib/types.js";
import { at, rejectionOf, subscriptionOf } from "./fixtures.js";

const CHANNEL_ID = "UCb2e-ivDST748PmPJOn4DnA";
const NOW = new Date("2026-11-06T12:00:00Z");

/** Videos-tab response in the current `lockupViewModel` layout, trimmed to what we read. */
function browseResponse(): unknown {
  const lockup = (id: string, title: string, age: string) => ({
    richItemRenderer: {
      content: {
        lockupViewModel: {
          contentId: id,
          contentType: "LOCKUP_CONTENT_TYPE_VIDEO",
          contentImage: {
            thumbnailViewModel: {
              image: {
                sources: [
                  { url: `https://i.ytimg.com/vi/${id}/small.jpg` },
                  { url: `https://i.ytimg.com/vi/${id}/large.jpg` },
                ],
              },
            },
          },
          metadata: {
            lockupMetadataViewModel: {
              title: { content: title },
              metadata: {
                contentMetadataViewModel: {
                  metadataRows: [
                    {
                      metadataParts: [
                        { text: { content: "2.4K views" } },
                        { text: { content: age } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });

  return {
    metadata: { channelMetadataRenderer: { title: "Universal Ambients", externalId: CHANNEL_ID } },
    contents: [
      lockup("sJ201-0lXts", "Seoul, 1910", "15 hours ago"),
      lockup("abcdefghijk", "Paris", "2 days ago"),
    ],
  };
}

interface FakeYouTube {
  resolveUrl?: () => unknown;
  page?: () => string;
  feed?: () => string;
}

/** Routes requests like www.youtube.com would, recording every URL requested. */
function fakeYouTube(routes: FakeYouTube): { context: AdapterContext; requested: string[] } {
  const requested: string[] = [];
  const route = <T>(url: string, handler: (() => T) | undefined): Promise<T> => {
    requested.push(url);
    return handler
      ? Promise.resolve().then(handler)
      : Promise.reject(new Error(`unexpected request ${url}`));
  };

  return {
    requested,
    context: {
      fetchText: (url) => route(url, url.includes("/feeds/") ? routes.feed : routes.page),
      fetchJson: (url) => route(url, undefined),
      postJson: (url) =>
        route(url, url.includes("/navigation/resolve_url") ? routes.resolveUrl : browseResponse),
      timeoutMs: 1000,
      itemsPerSource: 10,
    },
  };
}

const notFound = (): never => {
  throw new Error("Request failed with HTTP 404.");
};

describe("YouTube handle input", () => {
  it("treats bare names and pasted suffixes as handles", () => {
    expect(toYouTubeHandle("UniversalAmbients")).toBe("@UniversalAmbients");
    expect(toYouTubeHandle("@UniversalAmbients/videos")).toBe("@UniversalAmbients");
    expect(toYouTubeHandle(CHANNEL_ID)).toBe("");
    expect(toYouTubeHandle("https://www.youtube.com/@x")).toBe("");
  });

  it("maps handles and id-less channel URLs to the page that identifies the channel", () => {
    expect(youtubeChannelPageUrl("UniversalAmbients")).toBe(
      "https://www.youtube.com/@UniversalAmbients"
    );
    expect(youtubeChannelPageUrl("https://m.youtube.com/@name/shorts")).toBe(
      "https://www.youtube.com/@name"
    );
    expect(youtubeChannelPageUrl("https://www.youtube.com/c/Legacy/videos")).toBe(
      "https://www.youtube.com/c/Legacy"
    );
    expect(youtubeChannelPageUrl("https://www.youtube.com/user/old")).toBe(
      "https://www.youtube.com/user/old"
    );
    expect(youtubeChannelPageUrl("https://example.com/@name")).toBe("");
    expect(youtubeChannelPageUrl("https://www.youtube.com/watch?v=abc")).toBe("");
  });

  it("only asks for a lookup when there is no UC id", () => {
    expect(needsYouTubeLookup("https://www.youtube.com/@name/videos")).toBe(true);
    expect(needsYouTubeLookup("UniversalAmbients")).toBe(true);
    expect(needsYouTubeLookup(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toBe(false);
    expect(needsYouTubeLookup(CHANNEL_ID)).toBe(false);
  });

  it("stores bare names as handles", () => {
    expect(subscriptionOf({ platform: "youtube", channelId: "UniversalAmbients" }).channelId).toBe(
      "@UniversalAmbients"
    );
  });
});

describe("resolveYouTubeChannel", () => {
  it("returns direct channel ids without a request", async () => {
    const { context, requested } = fakeYouTube({});
    const resolved = await resolveYouTubeChannel(
      `https://www.youtube.com/channel/${CHANNEL_ID}`,
      context
    );

    expect(resolved.channelId).toBe(CHANNEL_ID);
    expect(requested).toHaveLength(0);
  });

  it("resolves a pasted handle URL through the resolve_url API, with the channel name", async () => {
    const { context, requested } = fakeYouTube({
      resolveUrl: () => ({ endpoint: { browseEndpoint: { browseId: CHANNEL_ID } } }),
    });
    const resolved = await resolveYouTubeChannel(
      "https://www.youtube.com/@UniversalAmbients/videos",
      context
    );

    expect(resolved).toEqual({
      channelId: CHANNEL_ID,
      channelName: "Universal Ambients",
      channelUrl: `https://www.youtube.com/channel/${CHANNEL_ID}`,
    });
    expect(at(requested, 0)).toContain("/youtubei/v1/navigation/resolve_url");
  });

  it("falls back to the channel page without the consent redirect", async () => {
    const { context, requested } = fakeYouTube({
      resolveUrl: () => {
        throw new TypeError("NetworkError when attempting to fetch resource.");
      },
      page: () =>
        `<meta property="og:title" content="Tom &amp; Jerry">"externalId":"${CHANNEL_ID}"`,
    });
    const resolved = await resolveYouTubeChannel("@example", context);

    expect(resolved.channelId).toBe(CHANNEL_ID);
    expect(resolved.channelName).toBe("Tom & Jerry");
    expect(at(requested, 1)).toBe("https://www.youtube.com/@example?ucbcb=1");
  });

  it("fails clearly when neither route finds the channel", async () => {
    const { context } = fakeYouTube({ resolveUrl: () => ({}), page: () => "<html></html>" });
    const error = await rejectionOf(resolveYouTubeChannel("@missing", context));
    expect(error.message).toContain("Could not resolve that YouTube handle.");
  });

  it("names the page when the fallback request fails", async () => {
    const { context } = fakeYouTube({ resolveUrl: () => ({}), page: notFound });
    const error = await rejectionOf(resolveYouTubeChannel("@missing", context));
    expect(error.message).toContain("Could not look up https://www.youtube.com/@missing");
  });

  it("rejects input that is not a channel", async () => {
    const { context } = fakeYouTube({});
    const error = await rejectionOf(resolveYouTubeChannel("https://example.com/x", context));
    expect(error.message).toContain("Enter a YouTube channel ID");
  });
});

describe("InnerTube parsing", () => {
  it("parses relative publish ages", () => {
    expect(parseRelativeAge("15 hours ago", NOW)).toBe("2026-11-05T21:00:00.000Z");
    expect(parseRelativeAge("Streamed 2 days ago", NOW)).toBe("2026-11-04T12:00:00.000Z");
    expect(parseRelativeAge("2.4K views", NOW)).toBe("");
  });

  it("extracts videos and the channel name from a Videos-tab response", () => {
    const { channelName, videos } = parseChannelVideos(browseResponse(), NOW);

    expect(channelName).toBe("Universal Ambients");
    expect(videos).toEqual([
      {
        videoId: "sJ201-0lXts",
        title: "Seoul, 1910",
        thumbnailUrl: "https://i.ytimg.com/vi/sJ201-0lXts/large.jpg",
        publishedAt: "2026-11-05T21:00:00.000Z",
      },
      {
        videoId: "abcdefghijk",
        title: "Paris",
        thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/large.jpg",
        publishedAt: "2026-11-04T12:00:00.000Z",
      },
    ]);
  });
});

describe("youtubeAdapter", () => {
  it("reads the Videos tab when the RSS feed fails", async () => {
    const { context, requested } = fakeYouTube({ feed: notFound });
    const items = await youtubeAdapter.fetchItems(
      subscriptionOf({ platform: "youtube", channelId: CHANNEL_ID, channelName: "UA" }),
      context
    );

    expect(requested.map((url) => url.replace(/\?.*/, ""))).toEqual([
      "https://www.youtube.com/feeds/videos.xml",
      "https://www.youtube.com/youtubei/v1/browse",
    ]);
    expect(items.map((item) => item.url)).toEqual([
      "https://www.youtube.com/watch?v=sJ201-0lXts",
      "https://www.youtube.com/watch?v=abcdefghijk",
    ]);
    expect(at(items, 0)).toMatchObject({ id: "youtube:sJ201-0lXts", channelName: "UA" });
  });

  it("looks up subscriptions saved as a bare name before reading videos", async () => {
    const { context, requested } = fakeYouTube({
      resolveUrl: () => ({ endpoint: { browseEndpoint: { browseId: CHANNEL_ID } } }),
      feed: notFound,
    });
    const legacy = {
      ...subscriptionOf({ platform: "youtube", channelId: "@x" }),
      channelId: "UniversalAmbients",
    };

    const items = await youtubeAdapter.fetchItems(legacy, context);

    expect(items).toHaveLength(2);
    expect(at(requested, 0)).toContain("/navigation/resolve_url");
    expect(at(requested, 1)).toContain(`channel_id=${CHANNEL_ID}`);
  });

  it("reports both errors when the feed and the fallback fail", async () => {
    const { context } = fakeYouTube({ feed: notFound });
    context.postJson = () => Promise.reject(new Error("blocked"));

    const error = await rejectionOf(
      youtubeAdapter.fetchItems(
        subscriptionOf({ platform: "youtube", channelId: CHANNEL_ID }),
        context
      )
    );
    expect(error.message).toBe(
      "YouTube feed failed (Request failed with HTTP 404.), and so did the fallback (blocked)."
    );
  });
});
