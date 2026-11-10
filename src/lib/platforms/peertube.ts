import { LocalizedError } from "../errors.js";
import { asArray, asRecord, asString } from "../guards.js";
import { toIsoString } from "../time.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { normalizeUrl, parseHttpUrl, resolveUrl, stripTrailingSlash } from "../url.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";

function absoluteUrl(value: string, base: string): string {
  return parseHttpUrl(value) ? normalizeUrl(value) : resolveUrl(value, `${base}/`);
}

function toFeedItem(value: unknown, subscription: Subscription, base: string): FeedItem | null {
  const video = asRecord(value);
  const uuid = asString(video.uuid) || asString(video.id);

  return createFeedItem(subscription, {
    id: uuid ? `peertube:${uuid}` : "",
    title: asString(video.name) || asString(video.title),
    url: absoluteUrl(asString(video.url), base) || `${base}/w/${uuid}`,
    thumbnailUrl: absoluteUrl(
      asString(video.thumbnailPath) || asString(video.thumbnailUrl) || asString(video.previewPath),
      base
    ),
    publishedAt: toIsoString(asString(video.publishedAt) || asString(video.createdAt)),
    channelName: asString(asRecord(video.channel).displayName),
  });
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  if (!parseHttpUrl(subscription.instanceUrl)) {
    throw new LocalizedError("peertube-no-instance");
  }

  const base = stripTrailingSlash(subscription.instanceUrl);
  const channel = encodeURIComponent(subscription.channelId);
  const endpoint = `${base}/api/v1/video-channels/${channel}/videos?sort=-publishedAt&count=${context.itemsPerSource}`;

  const payload = await context.fetchJson(endpoint, {
    timeoutMs: context.timeoutMs,
    accept: "application/json",
  });

  return asArray(asRecord(payload).data)
    .map((video) => toFeedItem(video, subscription, base))
    .filter(isFeedItem)
    .slice(0, context.itemsPerSource);
}

export const peertubeAdapter: PlatformAdapter = { fetchItems };
