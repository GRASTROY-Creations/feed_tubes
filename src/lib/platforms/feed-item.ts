import { cleanTitle } from "../text.js";
import type { FeedItem, Subscription } from "../types.js";
import { parseHttpUrl } from "../url.js";

export interface FeedItemFields {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string;
  channelName?: string;
}

/**
 * Builds a `FeedItem` attributed to `subscription`.
 * Returns `null` when the item lacks an id, a title, or a valid http(s) URL.
 */
export function createFeedItem(
  subscription: Subscription,
  fields: FeedItemFields
): FeedItem | null {
  const title = cleanTitle(fields.title);
  if (!fields.id || !title || !parseHttpUrl(fields.url)) {
    return null;
  }

  return {
    id: fields.id,
    platform: subscription.platform,
    channelId: subscription.channelId,
    channelName: fields.channelName || subscription.channelName || subscription.channelId,
    title,
    url: fields.url,
    thumbnailUrl: fields.thumbnailUrl,
    publishedAt: fields.publishedAt,
  };
}

export function isFeedItem(item: FeedItem | null): item is FeedItem {
  return item !== null;
}
