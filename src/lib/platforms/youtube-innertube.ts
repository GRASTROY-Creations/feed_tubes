/**
 * Minimal client for YouTube's internal "InnerTube" web API, which the youtube.com website
 * itself uses. It is undocumented, so every field is read defensively and callers treat it as
 * a fallback: it can change without notice.
 *
 * It is used because, from the EU, cookieless page requests are redirected to a consent page,
 * and because the public RSS feeds (`/feeds/videos.xml`) have been failing with HTTP 404/500.
 */
import { asArray, asRecord, asString, isRecord, type UnknownRecord } from "../guards.js";
import type { FetchOptions, PostJson } from "../types.js";
import { isYouTubeChannelId, YOUTUBE_ORIGIN } from "./youtube-urls.js";

const API_BASE = `${YOUTUBE_ORIGIN}/youtubei/v1`;

/** Identifies as the regular web client; English so publish ages can be parsed. */
const CLIENT_CONTEXT = {
  client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en", gl: "US" },
};

/** Protobuf-encoded `params` that select a channel's "Videos" tab. */
const VIDEOS_TAB_PARAMS = "EgZ2aWRlb3PyBgQKAjoA";

export interface InnertubeContext {
  postJson: PostJson;
  timeoutMs: number;
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

function call(endpoint: string, body: UnknownRecord, context: InnertubeContext): Promise<unknown> {
  const options: FetchOptions = { timeoutMs: context.timeoutMs };
  return context.postJson(
    `${API_BASE}/${endpoint}?prettyPrint=false`,
    { context: CLIENT_CONTEXT, ...body },
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
