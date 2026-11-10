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
  stream?: FeedItem["stream"];
  game?: string;
  /** Keep the item without a title; the card then shows a translated "Untitled" label. */
  allowUntitled?: boolean;
}

/**
 * Builds a `FeedItem` attributed to `subscription`.
 * Returns `null` when the item lacks an id, a valid http(s) URL, or a title (unless
 * `allowUntitled` is set). Titles are stored exactly as the platform publishes them.
 */
export function createFeedItem(
  subscription: Subscription,
  fields: FeedItemFields
): FeedItem | null {
  const title = cleanTitle(fields.title);
  if (!fields.id || (!title && !fields.allowUntitled) || !parseHttpUrl(fields.url)) {
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
    ...(fields.stream ? { stream: fields.stream } : {}),
    ...(fields.game ? { game: cleanTitle(fields.game) } : {}),
  };
}

export function isFeedItem(item: FeedItem | null): item is FeedItem {
  return item !== null;
}
