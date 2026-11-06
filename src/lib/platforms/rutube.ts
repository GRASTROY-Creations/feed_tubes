import { asArray, asRecord, asString } from "../guards.js";
import { toIsoString } from "../time.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { normalizeUrl, stripTrailingSlash } from "../url.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";

export const RUTUBE_ORIGIN = "https://rutube.ru";

/** Rutube sends ISO strings or Unix timestamps, depending on the field. */
function firstTimestamp(values: readonly unknown[]): string | number | null {
  for (const value of values) {
    if ((typeof value === "string" && value !== "") || typeof value === "number") {
      return value;
    }
  }
  return null;
}

function toFeedItem(value: unknown, subscription: Subscription): FeedItem | null {
  const video = asRecord(value);
  const id = asString(video.id);

  return createFeedItem(subscription, {
    id: id ? `rutube:${id}` : "",
    title: asString(video.title),
    url: normalizeUrl(video.video_url),
    thumbnailUrl: normalizeUrl(video.thumbnail_url),
    publishedAt: toIsoString(
      firstTimestamp([video.created_ts, video.publication_ts, video.date_ts])
    ),
    channelName: asString(asRecord(video.author).name),
  });
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  const base = stripTrailingSlash(subscription.instanceUrl || RUTUBE_ORIGIN);
  const person = encodeURIComponent(subscription.channelId);
  const endpoint = `${base}/api/video/person/${person}/?sort=publication_d&show_hidden_videos=False&limit=${context.itemsPerSource}`;

  const payload = await context.fetchJson(endpoint, {
    timeoutMs: context.timeoutMs,
    accept: "application/json",
  });

  return asArray(asRecord(payload).results)
    .map((video) => toFeedItem(video, subscription))
    .filter(isFeedItem)
    .slice(0, context.itemsPerSource);
}

export const rutubeAdapter: PlatformAdapter = { fetchItems };
