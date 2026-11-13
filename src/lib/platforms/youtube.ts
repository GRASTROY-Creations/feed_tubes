import { HostLimitError, LocalizedError, toLocalizedText } from "../errors.js";
import { decodeHtmlEntities } from "../text.js";
import { toIsoString } from "../time.js";
import type {
  AdapterContext,
  FeedItem,
  FetchText,
  PlatformAdapter,
  PostJson,
  Subscription,
} from "../types.js";
import { firstText, parseXml } from "../xml.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";
import { fetchChannelVideos, resolveChannelId } from "./youtube-innertube.js";
import {
  extractYouTubeChannelId,
  isYouTubeChannelId,
  withoutConsentRedirect,
  youtubeChannelPageUrl,
  youtubeChannelUrl,
  youtubeFeedUrl,
} from "./youtube-urls.js";

const FEED_ACCEPT = "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5";
const WATCH_URL = "https://www.youtube.com/watch?v=";

/**
 * Places on a channel page where YouTube embeds the `UC…` id, most reliable first.
 * `externalId` and the identifier meta tag describe the page's own channel; `channelId` can
 * also belong to recommended channels, so it is only a fallback.
 */
const CHANNEL_ID_PATTERNS: readonly RegExp[] = [
  /"externalId":"(UC[\w-]{22})"/,
  /<meta itemprop="identifier" content="(UC[\w-]{22})"/,
  /"channelId":"(UC[\w-]{22})"/,
  /channel_id=(UC[\w-]{22})/,
  /\/channel\/(UC[\w-]{22})/,
];
const OG_TITLE_PATTERN = /<meta property="og:title" content="([^"]*)"/i;

export interface ResolvedYouTubeChannel {
  channelId: string;
  channelName: string;
  channelUrl: string;
}

export interface ResolveContext {
  fetchText: FetchText;
  postJson: PostJson;
  timeoutMs: number;
}

export interface ResolveOptions {
  /** Also look up the channel's display name (costs an extra request). Default `true`. */
  includeName?: boolean;
}

function findChannelId(html: string): string {
  for (const pattern of CHANNEL_ID_PATTERNS) {
    const match = pattern.exec(html)?.[1];
    if (match) {
      return match;
    }
  }
  return "";
}

function resolved(channelId: string, channelName: string): ResolvedYouTubeChannel {
  return { channelId, channelName, channelUrl: youtubeChannelUrl(channelId) };
}

/** Fallback: scrape the channel page, bypassing the EU consent redirect. */
async function resolveFromPage(
  pageUrl: string,
  context: ResolveContext
): Promise<ResolvedYouTubeChannel | null> {
  const html = await context.fetchText(withoutConsentRedirect(pageUrl), {
    timeoutMs: context.timeoutMs,
    accept: "text/html",
  });

  const channelId = findChannelId(html);
  if (!channelId) {
    return null;
  }
  const title = OG_TITLE_PATTERN.exec(html)?.[1];
  return resolved(channelId, title ? decodeHtmlEntities(title) : "");
}

async function channelNameOf(channelId: string, context: ResolveContext): Promise<string> {
  try {
    return (await fetchChannelVideos(channelId, context)).channelName;
  } catch {
    // The name is optional; the user can still type one.
    return "";
  }
}

/**
 * Resolves a `UC…` id, a `/channel/UC…` URL, an `@handle` (with or without `@`), or a
 * youtube.com `/@handle`, `/c/…` or `/user/…` URL to a channel id.
 *
 * Tries YouTube's internal `resolve_url` API first, then the channel page. Anything but a
 * direct id needs requests to www.youtube.com, so the caller must hold that host permission.
 */
export async function resolveYouTubeChannel(
  input: string,
  context: ResolveContext,
  { includeName = true }: ResolveOptions = {}
): Promise<ResolvedYouTubeChannel> {
  const value = input.trim();
  const directId = extractYouTubeChannelId(value);
  if (directId) {
    return resolved(directId, "");
  }

  const pageUrl = youtubeChannelPageUrl(value);
  if (!pageUrl) {
    throw new LocalizedError("youtube-enter-id");
  }

  try {
    const channelId = await resolveChannelId(pageUrl, context);
    if (channelId) {
      return resolved(channelId, includeName ? await channelNameOf(channelId, context) : "");
    }
  } catch {
    // The internal API is undocumented and may change; the page below is the fallback.
  }

  try {
    const fromPage = await resolveFromPage(pageUrl, context);
    if (fromPage) {
      return fromPage;
    }
  } catch (error) {
    throw new LocalizedError(
      "youtube-lookup-failed",
      { url: pageUrl, error: toLocalizedText(error, "youtube-request-failed") },
      { cause: error }
    );
  }

  throw new LocalizedError("youtube-unresolved");
}

function toFeedItem(entry: Element, subscription: Subscription): FeedItem | null {
  const videoId =
    firstText(entry, ["yt:videoId"]) || firstText(entry, ["id"]).replace(/^yt:video:/, "");
  const links = Array.from(entry.getElementsByTagName("link"));
  const link = links.find((element) => element.getAttribute("rel") === "alternate") ?? links[0];

  return createFeedItem(subscription, {
    id: videoId ? `youtube:${videoId}` : "",
    title: decodeHtmlEntities(firstText(entry, ["title"])),
    url: link?.getAttribute("href")?.trim() ?? "",
    thumbnailUrl:
      entry.getElementsByTagName("media:thumbnail")[0]?.getAttribute("url")?.trim() ?? "",
    publishedAt: toIsoString(firstText(entry, ["published", "updated"])),
  });
}

function feedUrlFor(subscription: Subscription): string {
  return youtubeFeedUrl(subscription.channelId);
}

/**
 * Channel id to read videos for. Subscriptions saved with an unresolved `@handle`, bare name,
 * or channel URL are looked up on the fly so they keep working; re-saving them stores the id.
 */
async function channelIdFor(subscription: Subscription, context: AdapterContext): Promise<string> {
  if (isYouTubeChannelId(subscription.channelId)) {
    return subscription.channelId;
  }

  const lookup = [subscription.channelId, subscription.channelUrl].find(
    (value) => youtubeChannelPageUrl(value) !== ""
  );
  if (!lookup) {
    throw new LocalizedError("youtube-no-channel-id");
  }

  return (await resolveYouTubeChannel(lookup, context, { includeName: false })).channelId;
}

/** Primary source: the public RSS feed, which has exact publish dates. */
async function fetchFromFeed(
  channelId: string,
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  const xml = await context.fetchText(youtubeFeedUrl(channelId), {
    timeoutMs: context.timeoutMs,
    accept: FEED_ACCEPT,
  });

  const document = parseXml(xml, "youtube-invalid-xml");
  return Array.from(document.getElementsByTagName("entry"))
    .map((entry) => toFeedItem(entry, subscription))
    .filter(isFeedItem);
}

/** Fallback source: the channel's "Videos" tab via the internal API; dates are approximate. */
async function fetchFromVideosTab(
  channelId: string,
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  const { channelName, videos } = await fetchChannelVideos(channelId, context);
  if (videos.length === 0) {
    // More likely a changed response format than a channel without uploads.
    throw new LocalizedError("youtube-empty-videos-tab");
  }
  return videos
    .map((video) =>
      createFeedItem(subscription, {
        id: `youtube:${video.videoId}`,
        title: video.title,
        url: `${WATCH_URL}${encodeURIComponent(video.videoId)}`,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        channelName: subscription.channelName || channelName,
      })
    )
    .filter(isFeedItem);
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  const channelId = await channelIdFor(subscription, context);

  let items: FeedItem[];
  try {
    items = await fetchFromFeed(channelId, subscription, context);
  } catch (feedError) {
    // YouTube is paused or out of budget: the fallback would hit the same limit.
    if (feedError instanceof HostLimitError) {
      throw feedError;
    }
    try {
      items = await fetchFromVideosTab(channelId, subscription, context);
    } catch (fallbackError) {
      if (fallbackError instanceof HostLimitError) {
        throw fallbackError;
      }
      throw new LocalizedError(
        "youtube-both-failed",
        {
          feed: toLocalizedText(feedError, "common-unknown-error"),
          fallback: toLocalizedText(fallbackError, "common-unknown-error"),
        },
        { cause: fallbackError }
      );
    }
  }

  return items.slice(0, context.itemsPerSource);
}

export const youtubeAdapter: PlatformAdapter = { fetchItems, feedUrlFor };
