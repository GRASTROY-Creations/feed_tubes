/**
 * goodgame.ru adapter. GoodGame is a live-streaming site without a public list of past videos,
 * so a subscription shows one status card per channel, read from the public v4 API:
 *
 *   GET https://goodgame.ru/api/4/users/<channel>/stream
 *     → { online, title, game, link, streamPreview, poster, last_online_int, streamer, … }
 *
 * - Live: "LIVE: <title>" with the current stream preview, dated "now" (last_online_int),
 *   so it sorts to the top of the feed.
 * - Offline: "Last stream: <title>", dated when the channel was last online.
 * The card keeps the same id, so each refresh updates it instead of adding a new one.
 */
import { HttpError, LocalizedError } from "../errors.js";
import { asRecord, asString } from "../guards.js";
import { toIsoString } from "../time.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { resolveUrl } from "../url.js";
import { createFeedItem } from "./feed-item.js";

export const GOODGAME_ORIGIN = "https://goodgame.ru";
const API_BASE = `${GOODGAME_ORIGIN}/api/4`;

export function goodgameChannelUrl(channel: string): string {
  return `${GOODGAME_ORIGIN}/${encodeURIComponent(channel)}`;
}

/** Image paths come as `/files/…`, `//hls.goodgame.ru/…`, or absolute URLs. */
function imageUrl(value: unknown): string {
  return resolveUrl(asString(value), `${GOODGAME_ORIGIN}/`);
}

function unixToIso(value: unknown): string {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? toIsoString(seconds) : "";
}

export function toStatusItem(
  stream: Record<string, unknown>,
  subscription: Subscription
): FeedItem | null {
  const channel = asString(asRecord(stream.streamer).username) || subscription.channelId;
  const online = stream.online === true;

  return createFeedItem(subscription, {
    id: `goodgame:${channel.toLowerCase()}`,
    title: asString(stream.title) || asString(stream.stream_title),
    stream: online ? "live" : "last",
    game: asString(stream.game),
    allowUntitled: true,
    url: asString(stream.link) || goodgameChannelUrl(channel),
    thumbnailUrl: online
      ? imageUrl(stream.streamPreview) || imageUrl(stream.preview)
      : imageUrl(stream.poster) || imageUrl(stream.preview),
    publishedAt: unixToIso(stream.last_online_int),
    channelName: asString(asRecord(stream.streamer).nickname) || channel,
  });
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  if (!subscription.channelId) {
    throw new LocalizedError("goodgame-no-name");
  }

  const notFound = new LocalizedError("goodgame-not-found", { name: subscription.channelId });
  let payload: unknown;
  try {
    payload = await context.fetchJson(
      `${API_BASE}/users/${encodeURIComponent(subscription.channelId)}/stream`,
      { timeoutMs: context.timeoutMs, accept: "application/json" }
    );
  } catch (error) {
    throw error instanceof HttpError && error.status === 404 ? notFound : error;
  }

  const stream = asRecord(payload);
  if (stream.success === false) {
    throw notFound;
  }

  const item = toStatusItem(stream, subscription);
  return item ? [item] : [];
}

export const goodgameAdapter: PlatformAdapter = { fetchItems };
