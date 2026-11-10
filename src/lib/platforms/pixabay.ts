import { LocalizedError } from "../errors.js";
/**
 * Pixabay (https://pixabay.com) adapter, following one contributor's videos through the official
 * API: https://pixabay.com/api/docs/#api_search_videos
 *
 * - Every request needs the user's personal (free) API key, from Settings → Instances.
 * - The API has no contributor filter. The search syntax `user:<name>` is used instead; it is
 *   not documented, so results are also filtered by contributor here. If Pixabay ignores the
 *   syntax, the subscription reports "no videos" instead of showing unrelated footage.
 * - Results carry no upload time. The CDN path holds the upload day
 *   (`cdn.pixabay.com/video/2015/08/08/…`), so dates are day-precise.
 * - Pixabay asks API users to cache results for 24 hours (see `refreshCooldownMs`).
 */
import { asArray, asRecord, asString } from "../guards.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { parseHttpUrl } from "../url.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";

export const PIXABAY_ORIGIN = "https://pixabay.com";
const API_URL = `${PIXABAY_ORIGIN}/api/videos/`;

/** Pixabay's caching rule for API results. */
export const PIXABAY_CACHE_MS = 24 * 60 * 60 * 1000;

/** The API accepts 3–200 results per page. */
const MIN_PER_PAGE = 3;
const MAX_PER_PAGE = 200;

/** Upload day in the CDN path: `/video/2015/08/08/`. */
const CDN_DATE_PATTERN = /\/video\/(\d{4})\/(\d{2})\/(\d{2})\//;

export interface PixabayUser {
  /** Contributor name as shown on Pixabay, e.g. `Coverr-Free-Footage`. */
  name: string;
  /** Numeric user id, when known from a profile URL slug. */
  id: number | null;
}

/**
 * Splits a stored channel id into name and user id. Profile URLs end in `<name>-<id>`
 * (`/users/coverr-free-footage-1281706/`), which is how subscriptions store them.
 */
export function parsePixabayUser(channelId: string): PixabayUser {
  const match = /^(.+)-(\d+)$/.exec(channelId.trim());
  return match?.[1] && match[2]
    ? { name: match[1], id: Number(match[2]) }
    : { name: channelId.trim(), id: null };
}

export function pixabayProfileUrl(channelId: string): string {
  return `${PIXABAY_ORIGIN}/users/${encodeURIComponent(channelId.toLowerCase())}/`;
}

/** `https://cdn.pixabay.com/video/2015/08/08/125-…jpg` → `2015-08-08T00:00:00.000Z` */
export function uploadDateFromCdnUrl(url: string): string {
  const match = CDN_DATE_PATTERN.exec(url);
  if (!match) {
    return "";
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isFromUser(hit: Record<string, unknown>, user: PixabayUser): boolean {
  if (user.id !== null) {
    return Number(hit.user_id) === user.id;
  }
  return asString(hit.user).toLowerCase() === user.name.toLowerCase();
}

/**
 * Tags are the only descriptive text the API returns, already as one string:
 * `"flowers, yellow, blossom"`. They are used as published, only capitalized.
 */
function titleFromTags(tags: string): string {
  const title = tags.trim();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : "";
}

function toFeedItem(hit: Record<string, unknown>, subscription: Subscription): FeedItem | null {
  const id = asString(hit.id);
  const renditions = asRecord(hit.videos);
  const preview = asRecord(renditions.small).thumbnail ?? asRecord(renditions.medium).thumbnail;
  const thumbnailUrl = asString(preview);
  const pageUrl = asString(hit.pageURL);

  return createFeedItem(subscription, {
    id: id ? `pixabay:${id}` : "",
    title: titleFromTags(asString(hit.tags)),
    allowUntitled: true,
    url: parseHttpUrl(pageUrl) ? pageUrl : `${PIXABAY_ORIGIN}/videos/id-${id}/`,
    thumbnailUrl,
    publishedAt: uploadDateFromCdnUrl(thumbnailUrl || asString(asRecord(renditions.small).url)),
    channelName: asString(hit.user),
  });
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  const key = context.apiKeys.pixabay.trim();
  if (!key) {
    throw new LocalizedError("pixabay-no-key");
  }

  const user = parsePixabayUser(subscription.channelId);
  if (!user.name) {
    throw new LocalizedError("pixabay-no-name");
  }

  const perPage = Math.min(MAX_PER_PAGE, Math.max(MIN_PER_PAGE, context.itemsPerSource));
  const query = new URLSearchParams({
    key,
    q: `user:${user.name}`,
    order: "latest",
    per_page: String(perPage),
  });

  const payload = asRecord(
    await context.fetchJson(`${API_URL}?${query.toString()}`, {
      timeoutMs: context.timeoutMs,
      accept: "application/json",
    })
  );

  const items = asArray(payload.hits)
    .map(asRecord)
    .filter((hit) => isFromUser(hit, user))
    .map((hit) => toFeedItem(hit, subscription))
    .filter(isFeedItem);

  if (items.length === 0) {
    throw new LocalizedError("pixabay-no-videos", { name: user.name });
  }
  return items.slice(0, context.itemsPerSource);
}

export const pixabayAdapter: PlatformAdapter = { fetchItems };
