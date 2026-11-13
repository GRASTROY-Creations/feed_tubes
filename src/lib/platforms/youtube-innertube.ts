/**
 * Minimal client for YouTube's internal "InnerTube" web API, which the youtube.com website
 * itself uses. It is undocumented, so every field is read defensively and callers treat it as
 * a fallback: it can change without notice.
 *
 * It is used because, from the EU, cookieless page requests are redirected to a consent page,
 * and because the public RSS feeds (`/feeds/videos.xml`) have been failing with HTTP 404/500.
 */
import { asArray, asRecord, asString, isRecord, type UnknownRecord } from "../guards.js";
import type { FetchOptions, FetchText, PostJson } from "../types.js";
import { isYouTubeChannelId, YOUTUBE_ORIGIN } from "./youtube-urls.js";

const API_BASE = `${YOUTUBE_ORIGIN}/youtubei/v1`;

/** `clientName` of the regular web client, as the numeric `X-YouTube-Client-Name` header. */
const WEB_CLIENT_NAME = "WEB";
const WEB_CLIENT_ID = "1";

/**
 * Used when the current version cannot be read. YouTube rejects versions that are too old,
 * so it is read from YouTube itself first (see `clientVersion`).
 */
export const FALLBACK_CLIENT_VERSION = "2.20261101.00.00";
/** Small service-worker bootstrap that names the current web client version. */
const CLIENT_VERSION_URL = `${YOUTUBE_ORIGIN}/sw.js_data`;
const CLIENT_VERSION_PATTERN = /"(2\.20\d{6}\.\d{2}\.\d{2})"/;
const CLIENT_VERSION_TTL_MS = 24 * 60 * 60 * 1000;
/** After a failed lookup, use the fallback for this long before asking again. */
const CLIENT_VERSION_RETRY_MS = 60 * 60 * 1000;

/** Protobuf-encoded `params` that select a channel's "Videos" tab. */
const VIDEOS_TAB_PARAMS = "EgZ2aWRlb3PyBgQKAjoA";

export interface InnertubeContext {
  fetchText: FetchText;
  postJson: PostJson;
  timeoutMs: number;
}

/** The current web client version, as found in `sw.js_data`; `""` when absent. */
export function parseClientVersion(text: string): string {
  return CLIENT_VERSION_PATTERN.exec(text)?.[1] ?? "";
}

let cachedVersion: { version: string; expiresAt: number } | null = null;

/** Forgets the looked-up client version. For tests. */
export function resetClientVersion(): void {
  cachedVersion = null;
}

/**
 * The web client version to send. Looked up once a day (one small request, made only when
 * the API is actually needed), so requests carry the version the website itself uses.
 */
export async function clientVersion(context: InnertubeContext, now = Date.now()): Promise<string> {
  if (cachedVersion && cachedVersion.expiresAt > now) {
    return cachedVersion.version;
  }
  try {
    const found = parseClientVersion(
      await context.fetchText(CLIENT_VERSION_URL, { timeoutMs: context.timeoutMs, accept: "*/*" })
    );
    cachedVersion = found
      ? { version: found, expiresAt: now + CLIENT_VERSION_TTL_MS }
      : { version: FALLBACK_CLIENT_VERSION, expiresAt: now + CLIENT_VERSION_RETRY_MS };
  } catch {
    cachedVersion = { version: FALLBACK_CLIENT_VERSION, expiresAt: now + CLIENT_VERSION_RETRY_MS };
  }
  return cachedVersion.version;
}

export interface InnertubeVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  /** Approximate ISO date derived from text like "3 days ago"; `""` when unknown. */
  publishedAt: string;
}

export interface InnertubeChannelVideos {
  channelName: string;
  videos: InnertubeVideo[];
}

/**
 * Calls the API the way the website's own web client does: the same client name and version,
 * in the body and in the `X-YouTube-Client-*` headers. English, so publish ages can be parsed.
 */
async function call(
  endpoint: string,
  body: UnknownRecord,
  context: InnertubeContext
): Promise<unknown> {
  const version = await clientVersion(context);
  const options: FetchOptions = {
    timeoutMs: context.timeoutMs,
    headers: { "X-YouTube-Client-Name": WEB_CLIENT_ID, "X-YouTube-Client-Version": version },
  };
  const client = { clientName: WEB_CLIENT_NAME, clientVersion: version, hl: "en", gl: "US" };
  return context.postJson(
    `${API_BASE}/${endpoint}?prettyPrint=false`,
    { context: { client }, ...body },
    options
  );
}

/** Resolves a channel page URL (`/@handle`, `/c/…`, `/user/…`) to its `UC…` id, or `""`. */
export async function resolveChannelId(
  pageUrl: string,
  context: InnertubeContext
): Promise<string> {
  const response = asRecord(await call("navigation/resolve_url", { url: pageUrl }, context));
  const browseId = asString(asRecord(asRecord(response.endpoint).browseEndpoint).browseId);
  return isYouTubeChannelId(browseId) ? browseId : "";
}

// --- Publish ages ------------------------------------------------------------

const AGE_PATTERN = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;

const SECONDS_PER_UNIT: Readonly<Record<string, number>> = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  year: 365 * 24 * 60 * 60,
};

/** `"3 days ago"` (also `"Streamed 3 days ago"`) → ISO date three days before `now`. */
export function parseRelativeAge(text: string, now: Date): string {
  const match = AGE_PATTERN.exec(text);
  const unitSeconds = SECONDS_PER_UNIT[match?.[2]?.toLowerCase() ?? ""];
  if (!match || unitSeconds === undefined) {
    return "";
  }
  return new Date(now.getTime() - Number(match[1]) * unitSeconds * 1000).toISOString();
}

// --- Video lists ---------------------------------------------------------------

/** Collects every object stored under `key` anywhere in `value`. */
function collect(value: unknown, key: string, found: UnknownRecord[] = []): UnknownRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collect(item, key, found);
    }
  } else if (isRecord(value)) {
    for (const [name, child] of Object.entries(value)) {
      if (name === key && isRecord(child)) {
        found.push(child);
      } else {
        collect(child, key, found);
      }
    }
  }
  return found;
}

function largestThumbnail(sources: unknown): string {
  const urls = asArray(sources).map((source) => asString(asRecord(source).url));
  return urls.at(-1) ?? "";
}

/** Current layout: `lockupViewModel` with `contentId` and metadata rows. */
function fromLockup(lockup: UnknownRecord, now: Date): InnertubeVideo | null {
  if (asString(lockup.contentType) !== "LOCKUP_CONTENT_TYPE_VIDEO") {
    return null;
  }

  const metadata = asRecord(asRecord(lockup.metadata).lockupMetadataViewModel);
  const rows = asArray(asRecord(asRecord(metadata.metadata).contentMetadataViewModel).metadataRows);
  const parts = rows.flatMap((row) =>
    asArray(asRecord(row).metadataParts).map((part) =>
      asString(asRecord(asRecord(part).text).content)
    )
  );
  const image = asRecord(asRecord(asRecord(lockup.contentImage).thumbnailViewModel).image);

  return {
    videoId: asString(lockup.contentId),
    title: asString(asRecord(metadata.title).content),
    thumbnailUrl: largestThumbnail(image.sources),
    publishedAt: parts.map((part) => parseRelativeAge(part, now)).find(Boolean) ?? "",
  };
}

/** Older layout, still served to some clients: `videoRenderer` / `gridVideoRenderer`. */
function fromVideoRenderer(renderer: UnknownRecord, now: Date): InnertubeVideo {
  const title = asRecord(renderer.title);
  const runs = asArray(title.runs).map((run) => asString(asRecord(run).text));
  return {
    videoId: asString(renderer.videoId),
    title: asString(title.simpleText) || runs.join(""),
    thumbnailUrl: largestThumbnail(asRecord(renderer.thumbnail).thumbnails),
    publishedAt: parseRelativeAge(asString(asRecord(renderer.publishedTimeText).simpleText), now),
  };
}

/** Extracts the videos (newest first, as YouTube lists them) from a browse response. */
export function parseChannelVideos(response: unknown, now: Date): InnertubeChannelVideos {
  const videos = [
    ...collect(response, "lockupViewModel").map((lockup) => fromLockup(lockup, now)),
    ...collect(response, "videoRenderer").map((renderer) => fromVideoRenderer(renderer, now)),
    ...collect(response, "gridVideoRenderer").map((renderer) => fromVideoRenderer(renderer, now)),
  ].filter((video): video is InnertubeVideo => video !== null && video.videoId !== "");

  // Keep the first occurrence of each video, preserving YouTube's order.
  const byId = new Map<string, InnertubeVideo>();
  for (const video of videos) {
    if (!byId.has(video.videoId)) {
      byId.set(video.videoId, video);
    }
  }

  const metadata = asRecord(asRecord(asRecord(response).metadata).channelMetadataRenderer);
  return { channelName: asString(metadata.title), videos: [...byId.values()] };
}

/** Lists the most recent uploads on a channel's "Videos" tab. */
export async function fetchChannelVideos(
  channelId: string,
  context: InnertubeContext,
  now = new Date()
): Promise<InnertubeChannelVideos> {
  const response = await call(
    "browse",
    { browseId: channelId, params: VIDEOS_TAB_PARAMS },
    context
  );
  return parseChannelVideos(response, now);
}
