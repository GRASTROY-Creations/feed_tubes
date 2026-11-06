import { parseHttpUrl } from "../url.js";

export const YOUTUBE_ORIGIN = "https://www.youtube.com";

const CHANNEL_ID_PATTERN = /^UC[\w-]{22}$/;
const CHANNEL_URL_PATTERN = /youtube\.com\/channel\/(UC[\w-]{22})/i;

export function isYouTubeChannelId(value: unknown): value is string {
  return typeof value === "string" && CHANNEL_ID_PATTERN.test(value.trim());
}

/** Accepts a bare `UC…` id or any URL containing `/channel/UC…`; returns `""` otherwise. */
export function extractYouTubeChannelId(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";

  if (isYouTubeChannelId(text)) {
    return text;
  }

  return CHANNEL_URL_PATTERN.exec(text)?.[1] ?? "";
}

export function isYouTubeHandle(value: string): boolean {
  return value.trim().startsWith("@");
}

/** A single word without URL syntax, such as `UniversalAmbients`. */
const BARE_NAME_PATTERN = /^[^\s/@?#:]+$/;

/**
 * Canonical `@handle` for handle-like input: `@name`, `@name/videos`, or a bare `name`.
 * Returns `""` for channel ids, URLs, and anything else.
 */
export function toYouTubeHandle(value: string): string {
  const text = value.trim();
  if (isYouTubeHandle(text)) {
    // Tolerate pasted suffixes such as `@name/videos`.
    return text.split("/")[0] ?? text;
  }
  if (extractYouTubeChannelId(text) || !BARE_NAME_PATTERN.test(text)) {
    return "";
  }
  return `@${text}`;
}

const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$/i;
/** Channel page paths that do not contain the `UC…` id: `/@handle`, `/c/name`, `/user/name`. */
const CHANNEL_PAGE_PATH_PATTERN = /^\/(@[^/]+|c\/[^/]+|user\/[^/]+)/;

/**
 * Channel page that identifies the channel, for an `@handle`, a bare handle name, or a
 * youtube.com channel URL such as `https://www.youtube.com/@name/videos`.
 * Returns `""` when no lookup can help.
 */
export function youtubeChannelPageUrl(value: string): string {
  const text = value.trim();

  const handle = toYouTubeHandle(text);
  if (handle) {
    return youtubeHandleUrl(handle);
  }

  const url = parseHttpUrl(text);
  if (!url || !YOUTUBE_HOST_PATTERN.test(url.hostname)) {
    return "";
  }

  const path = CHANNEL_PAGE_PATH_PATTERN.exec(url.pathname)?.[1];
  return path ? `${YOUTUBE_ORIGIN}/${path}` : "";
}

/** True when `value` names a channel whose `UC…` id must be looked up on its page. */
export function needsYouTubeLookup(value: string): boolean {
  return !extractYouTubeChannelId(value) && youtubeChannelPageUrl(value) !== "";
}

export function youtubeChannelUrl(channelId: string): string {
  return `${YOUTUBE_ORIGIN}/channel/${channelId}`;
}

/** `@name` → `https://www.youtube.com/@name` */
export function youtubeHandleUrl(handle: string): string {
  return `${YOUTUBE_ORIGIN}/${encodeURIComponent(handle).replace("%40", "@")}`;
}

/** Channel page for a `UC…` id or an `@handle`. */
export function youtubeChannelOrHandleUrl(channelId: string): string {
  return isYouTubeHandle(channelId) ? youtubeHandleUrl(channelId) : youtubeChannelUrl(channelId);
}

/**
 * Adds `ucbcb=1`, which makes YouTube serve the page instead of redirecting cookieless
 * requests from the EU to consent.youtube.com (a host the extension cannot read).
 */
export function withoutConsentRedirect(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set("ucbcb", "1");
  return url.href;
}

export function youtubeFeedUrl(channelId: string): string {
  return `${YOUTUBE_ORIGIN}/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}
