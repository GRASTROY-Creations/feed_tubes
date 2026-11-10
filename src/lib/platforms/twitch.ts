/**
 * Twitch adapter. Two ways to read a channel:
 *
 * 1. **RSS bridge** — when the subscription has a feed URL (e.g. an RSSHub `/twitch/video/<login>`
 *    route), it is read like any RSS feed. No Twitch account needed.
 * 2. **Official Helix API** — otherwise. Needs the Client ID of a Twitch application and a user
 *    token from "Sign in with Twitch" (Settings → Instances); see `twitch-auth.ts`.
 *      GET /helix/users?login=<login>                 → channel id and display name
 *      GET /helix/videos?user_id=<id>&first=N         → past broadcasts, highlights, uploads
 *      GET /helix/streams?user_login=<login>          → the live stream, if any
 *    A live stream is shown as an extra "LIVE: …" card at the top.
 */
import { HttpError, LocalizedError } from "../errors.js";
import { asArray, asRecord, asString } from "../guards.js";
import { toIsoString } from "../time.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";
import { fetchFeedItems } from "./generic-rss.js";

export const TWITCH_ORIGIN = "https://www.twitch.tv";
export const TWITCH_API = "https://api.twitch.tv/helix";

/** Thumbnail size requested from Twitch's `%{width}x%{height}` / `{width}x{height}` templates. */
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;
/** Helix accepts 1–100 videos per page. */
const MAX_VIDEOS = 100;

export function twitchChannelUrl(login: string): string {
  return `${TWITCH_ORIGIN}/${encodeURIComponent(login)}`;
}

/** Fills in Twitch's size placeholders; returns `""` for "still processing" placeholders. */
export function twitchThumbnail(template: string): string {
  if (!template || template.includes("404_processing")) {
    return "";
  }
  return template
    .replace(/%?\{width\}/g, String(THUMB_WIDTH))
    .replace(/%?\{height\}/g, String(THUMB_HEIGHT));
}

function helixHeaders(context: AdapterContext): Record<string, string> {
  const { twitchClientId, twitchToken } = context.apiKeys;
  if (!twitchClientId.trim() || !twitchToken.trim()) {
    throw new LocalizedError("twitch-sign-in");
  }
  return { "Client-Id": twitchClientId.trim(), Authorization: `Bearer ${twitchToken.trim()}` };
}

async function helix(path: string, context: AdapterContext): Promise<Record<string, unknown>[]> {
  const headers = helixHeaders(context);
  try {
    const payload = await context.fetchJson(`${TWITCH_API}/${path}`, {
      timeoutMs: context.timeoutMs,
      accept: "application/json",
      headers,
    });
    return asArray(asRecord(payload).data).map(asRecord);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      throw new LocalizedError("twitch-expired", undefined, { cause: error });
    }
    throw error;
  }
}

function videoItem(video: Record<string, unknown>, subscription: Subscription): FeedItem | null {
  const id = asString(video.id);
  return createFeedItem(subscription, {
    id: id ? `twitch:${id}` : "",
    title: asString(video.title),
    url: asString(video.url) || `${TWITCH_ORIGIN}/videos/${id}`,
    thumbnailUrl: twitchThumbnail(asString(video.thumbnail_url)),
    publishedAt: toIsoString(asString(video.published_at) || asString(video.created_at)),
    channelName: asString(video.user_name),
  });
}

function liveItem(
  stream: Record<string, unknown>,
  subscription: Subscription,
  login: string
): FeedItem | null {
  return createFeedItem(subscription, {
    id: `twitch:live:${asString(stream.id)}`,
    title: asString(stream.title),
    stream: "live",
    game: asString(stream.game_name),
    allowUntitled: true,
    url: twitchChannelUrl(login),
    thumbnailUrl: twitchThumbnail(asString(stream.thumbnail_url)),
    publishedAt: toIsoString(asString(stream.started_at)),
    channelName: asString(stream.user_name),
  });
}

async function fetchFromHelix(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  const login = subscription.channelId.toLowerCase();
  const [user] = await helix(`users?login=${encodeURIComponent(login)}`, context);
  const userId = asString(user?.id);
  if (!userId) {
    throw new LocalizedError("twitch-not-found", { name: subscription.channelId });
  }

  const first = Math.min(MAX_VIDEOS, Math.max(1, context.itemsPerSource));
  const [videos, streams] = await Promise.all([
    helix(`videos?user_id=${encodeURIComponent(userId)}&first=${first}&sort=time`, context),
    helix(`streams?user_login=${encodeURIComponent(login)}`, context),
  ]);

  const live = streams.map((stream) => liveItem(stream, subscription, login));
  const past = videos.map((video) => videoItem(video, subscription));
  return [...live, ...past].filter(isFeedItem).slice(0, context.itemsPerSource);
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  if (subscription.feedUrl) {
    return fetchFeedItems(subscription, subscription.feedUrl, context);
  }
  if (!subscription.channelId) {
    throw new LocalizedError("twitch-no-name");
  }
  return fetchFromHelix(subscription, context);
}

export const twitchAdapter: PlatformAdapter = {
  fetchItems,
  feedUrlFor: (subscription) => subscription.feedUrl,
};
