/**
 * D.Tube (https://d.tube) adapter, using the JSON API that the d.tube website itself calls:
 *
 *   GET https://api.d.tube/channels/<username>          → { id, username, … }
 *   GET https://api.d.tube/videos?channel=<id>&limit=N  → [{ id, title, thumbnail_url, created_at, user }]
 *
 * Videos come newest first with exact ISO dates. The public watch URL uses the video's UUID
 * written in base58 (`/watch/Y6fNR7jS5j9QyzvQJPGQ66`), which `dtubeWatchUrl` reproduces.
 */
import { asArray, asRecord, asString } from "../guards.js";
import { toIsoString } from "../time.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";

export const DTUBE_ORIGIN = "https://d.tube";
export const DTUBE_API = "https://api.d.tube";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** UUID → the short base58 id d.tube uses in watch URLs; `""` for anything else. */
export function dtubeShortId(uuid: string): string {
  if (!UUID_PATTERN.test(uuid)) {
    return "";
  }

  let value = BigInt(`0x${uuid.replaceAll("-", "")}`);
  let result = "";
  while (value > 0n) {
    result = `${BASE58_ALPHABET.charAt(Number(value % 58n))}${result}`;
    value /= 58n;
  }
  return result || "1";
}

export function dtubeWatchUrl(videoUuid: string): string {
  const shortId = dtubeShortId(videoUuid);
  return shortId ? `${DTUBE_ORIGIN}/watch/${shortId}` : "";
}

export function dtubeChannelUrl(username: string): string {
  return `${DTUBE_ORIGIN}/channel/${encodeURIComponent(username)}`;
}

async function channelUuid(username: string, context: AdapterContext): Promise<string> {
  if (UUID_PATTERN.test(username)) {
    return username;
  }

  const channel = asRecord(
    await context.fetchJson(`${DTUBE_API}/channels/${encodeURIComponent(username)}`, {
      timeoutMs: context.timeoutMs,
      accept: "application/json",
    })
  );
  const id = asString(channel.id);
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`D.Tube has no channel named "${username}".`);
  }
  return id;
}

function toFeedItem(value: unknown, subscription: Subscription): FeedItem | null {
  const video = asRecord(value);
  const id = asString(video.id);

  return createFeedItem(subscription, {
    id: id ? `dtube:${id}` : "",
    title: asString(video.title),
    url: dtubeWatchUrl(id),
    thumbnailUrl: asString(video.thumbnail_url),
    publishedAt: toIsoString(asString(video.created_at)),
    channelName: asString(asRecord(video.user).username),
  });
}

async function fetchItems(
  subscription: Subscription,
  context: AdapterContext
): Promise<FeedItem[]> {
  if (!subscription.channelId) {
    throw new Error("This D.Tube subscription has no channel name.");
  }

  const channel = await channelUuid(subscription.channelId, context);
  const payload = await context.fetchJson(
    `${DTUBE_API}/videos?channel=${encodeURIComponent(channel)}&limit=${context.itemsPerSource}`,
    { timeoutMs: context.timeoutMs, accept: "application/json" }
  );

  return asArray(payload)
    .map((video) => toFeedItem(video, subscription))
    .filter(isFeedItem)
    .slice(0, context.itemsPerSource);
}

export const dtubeAdapter: PlatformAdapter = { fetchItems };
