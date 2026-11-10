import { getPlatform, isFeedOnlyPlatform, isPlatformId } from "./platforms/registry.js";
import { ODYSEE_ORIGIN, odyseeHandle } from "./platforms/odysee.js";
import { DAILYMOTION_ORIGIN } from "./platforms/dailymotion.js";
import { dtubeChannelUrl } from "./platforms/dtube.js";
import { goodgameChannelUrl } from "./platforms/goodgame.js";
import { pixabayProfileUrl } from "./platforms/pixabay.js";
import { twitchChannelUrl } from "./platforms/twitch.js";
import { RUTUBE_ORIGIN } from "./platforms/rutube.js";
import { toYouTubeHandle, youtubeChannelOrHandleUrl } from "./platforms/youtube-urls.js";
import type { PlatformId, RawSubscription, Subscription } from "./types.js";
import {
  hostKey,
  normalizeBaseUrl,
  normalizeUrl,
  originOf,
  parseHttpUrl,
  stripTrailingSlash,
} from "./url.js";
import { t, type MessageKey } from "./i18n/index.js";

const MAX_NAME_LENGTH = 300;
const MAX_URL_LENGTH = 4096;
const DISABLED_VALUES = new Set(["false", "0", "no", "off", "disabled"]);

/** Column/property names accepted for each field across import formats. */
const FIELD_ALIASES = {
  platform: ["platform", "Platform"],
  instanceUrl: ["instanceUrl", "instance_url", "instanceurl"],
  channelId: ["channelId", "channel_id", "channelid", "id"],
  channelName: ["channelName", "channel_name", "channelname", "name", "title"],
  channelUrl: ["channelUrl", "channel_url", "channelurl", "url"],
  feedUrl: ["feedUrl", "feed_url", "feedurl", "rssUrl", "rss_url"],
  enabled: ["enabled", "Enabled"],
} as const satisfies Record<string, readonly string[]>;

type Field = keyof typeof FIELD_ALIASES;

function valueOf(raw: RawSubscription, field: Field): unknown {
  for (const name of FIELD_ALIASES[field]) {
    const value = raw[name];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return "";
}

function textOf(raw: RawSubscription, field: Field): string {
  const value = valueOf(raw, field);
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value).trim()
    : "";
}

function parsePlatform(raw: RawSubscription): PlatformId | null {
  const platform = textOf(raw, "platform").toLowerCase();
  return isPlatformId(platform) ? platform : null;
}

function parseEnabled(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return text.trim() === "" || !DISABLED_VALUES.has(text.trim().toLowerCase());
}

/** First path segment of a URL, or the text itself when it is not a URL. */
function extractHandle(value: string): string {
  const url = parseHttpUrl(value);
  if (!url) {
    return value;
  }

  const [first] = url.pathname.split("/").filter(Boolean);
  return first ? decodeURIComponent(first) : "";
}

/** Trimmed raw inputs that the per-platform normalizers work from. */
interface SubscriptionInput {
  channelId: string;
  channelUrl: string;
  instanceUrl: string;
  feedUrl: string;
}

type DerivedFields = Partial<SubscriptionInput>;

/** URL found in either the channel URL or the channel id field. */
function urlFromInput(input: SubscriptionInput): URL | null {
  return parseHttpUrl(input.channelUrl) ?? parseHttpUrl(input.channelId);
}

function normalizeYouTube(input: SubscriptionInput): DerivedFields {
  let { channelId } = input;
  let channelUrl = normalizeUrl(input.channelUrl);

  const url = urlFromInput(input);
  if (url && /(^|\.)youtube\.com$/i.test(url.hostname)) {
    const channelMatch = /^\/channel\/(UC[\w-]{22})/.exec(url.pathname)?.[1];
    const handleMatch = /^\/@([^/]+)/.exec(url.pathname)?.[1];
    if (channelMatch) {
      channelId = channelMatch;
    } else if (handleMatch) {
      channelId = `@${handleMatch}`;
    }
  }

  if (!channelId && channelUrl) {
    channelId = channelUrl;
  }

  // YouTube channel names are handles: `UniversalAmbients` and `@UniversalAmbients/videos`
  // both mean `@UniversalAmbients`.
  channelId = toYouTubeHandle(channelId) || channelId;

  if (channelId && !channelUrl) {
    channelUrl = youtubeChannelOrHandleUrl(channelId);
  }

  return { channelId, channelUrl };
}

function normalizePeerTube(input: SubscriptionInput): DerivedFields {
  let instanceUrl = normalizeBaseUrl(input.instanceUrl);
  let { channelId } = input;
  let channelUrl = normalizeUrl(input.channelUrl);

  const url = urlFromInput({ ...input, channelUrl });
  if (url) {
    instanceUrl ||= originOf(url.href);
    const match = /^\/(?:c|video-channels)\/([^/]+)/.exec(url.pathname)?.[1];
    if (match) {
      channelId = decodeURIComponent(match);
    }
  }

  if (!channelUrl && instanceUrl && channelId) {
    channelUrl = `${stripTrailingSlash(instanceUrl)}/c/${encodeURIComponent(channelId)}`;
  }

  return { instanceUrl, channelId, channelUrl };
}

function normalizeOdysee(input: SubscriptionInput): DerivedFields {
  let { channelId } = input;
  let channelUrl = normalizeUrl(input.channelUrl);

  const url = urlFromInput({ ...input, channelUrl });
  if (url && /(^|\.)odysee\.com$/i.test(url.hostname)) {
    channelId = extractHandle(url.href) || channelId;
    channelUrl = url.href;
  }

  if (!channelUrl && channelId) {
    channelUrl = `${ODYSEE_ORIGIN}/${odyseeHandle(channelId)}`;
  }

  return { channelId, channelUrl };
}

function normalizeRutube(input: SubscriptionInput): DerivedFields {
  let { channelId } = input;
  let channelUrl = normalizeUrl(input.channelUrl);

  const match = urlFromInput(input)?.pathname.match(/\/channel\/(\d+)/)?.[1];
  if (match) {
    channelId = match;
  }

  if (!channelUrl && /^\d+$/.test(channelId)) {
    channelUrl = `${RUTUBE_ORIGIN}/channel/${channelId}/`;
  }

  return { channelId, channelUrl };
}

function normalizeDailymotion(input: SubscriptionInput): DerivedFields {
  let { channelId } = input;
  let channelUrl = normalizeUrl(input.channelUrl);

  const url = urlFromInput(input);
  if (url) {
    const userMatch = /\/user\/([^/]+)/.exec(url.pathname)?.[1];
    channelId = userMatch ? decodeURIComponent(userMatch) : extractHandle(url.href) || channelId;
  }

  if (!channelUrl && channelId) {
    channelUrl = `${DAILYMOTION_ORIGIN}/${encodeURIComponent(channelId)}`;
  }

  return { channelId, channelUrl };
}

/** Accepts `name`, `@name`, or a `d.tube/channel/<name>` URL; stores the bare name. */
function normalizeDtube(input: SubscriptionInput): DerivedFields {
  let channelId = input.channelId.replace(/^@/, "");

  const url = urlFromInput(input);
  if (url && /(^|\.)d\.tube$/i.test(url.hostname)) {
    const match = /^\/channel\/([^/]+)/.exec(url.pathname)?.[1];
    channelId = match ? decodeURIComponent(match) : "";
  }

  return { channelId, channelUrl: channelId ? dtubeChannelUrl(channelId) : "" };
}

/**
 * Accepts a contributor name, a `name-1234` profile slug, or a `pixabay.com/users/name-1234/`
 * URL. The slug (with its numeric id, when known) is stored as the channel id.
 */
function normalizePixabay(input: SubscriptionInput): DerivedFields {
  let channelId = input.channelId.replace(/^@/, "");

  const url = urlFromInput(input);
  if (url && /(^|\.)pixabay\.com$/i.test(url.hostname)) {
    const match = /^\/(?:[a-z]{2}\/)?users\/([^/]+)/.exec(url.pathname)?.[1];
    channelId = match ? decodeURIComponent(match) : "";
  }

  return { channelId, channelUrl: channelId ? pixabayProfileUrl(channelId) : "" };
}

/** twitch.tv paths that are pages, not channels. */
const TWITCH_RESERVED_PATHS = new Set([
  "videos",
  "directory",
  "search",
  "settings",
  "downloads",
  "p",
]);

/**
 * Accepts `name`, `@name`, or a `twitch.tv/<name>[/videos]` URL; stores the lowercase login.
 * An optional RSS bridge feed URL is kept as given.
 */
function normalizeTwitch(input: SubscriptionInput): DerivedFields {
  let channelId = input.channelId.replace(/^@/, "");

  const url = urlFromInput(input);
  if (url && /(^|\.)twitch\.tv$/i.test(url.hostname)) {
    const segment = url.pathname.split("/").find(Boolean) ?? "";
    channelId = TWITCH_RESERVED_PATHS.has(segment.toLowerCase()) ? "" : decodeURIComponent(segment);
  }

  channelId = channelId.toLowerCase();
  return { channelId, channelUrl: channelId ? twitchChannelUrl(channelId) : "" };
}

/** Accepts `name`, a `goodgame.ru/<name>` or older `goodgame.ru/channel/<name>` URL. */
function normalizeGoodgame(input: SubscriptionInput): DerivedFields {
  let { channelId } = input;

  const url = urlFromInput(input);
  if (url && /(^|\.)goodgame\.ru$/i.test(url.hostname)) {
    const segments = url.pathname.split("/").filter(Boolean);
    const name = segments[0]?.toLowerCase() === "channel" ? segments[1] : segments[0];
    channelId = name ? decodeURIComponent(name) : "";
  }

  return { channelId, channelUrl: channelId ? goodgameChannelUrl(channelId) : "" };
}

function normalizeFeed(input: SubscriptionInput): DerivedFields {
  const channelUrl = normalizeUrl(input.channelUrl);
  let feedUrl = normalizeUrl(input.feedUrl);

  if (!feedUrl && parseHttpUrl(channelUrl)) {
    feedUrl = channelUrl;
  }

  return {
    feedUrl,
    instanceUrl: normalizeBaseUrl(input.instanceUrl) || originOf(feedUrl),
    channelUrl: channelUrl || feedUrl,
  };
}

const NORMALIZERS: Record<PlatformId, (input: SubscriptionInput) => DerivedFields> = {
  youtube: normalizeYouTube,
  peertube: normalizePeerTube,
  odysee: normalizeOdysee,
  rutube: normalizeRutube,
  dailymotion: normalizeDailymotion,
  dtube: normalizeDtube,
  pixabay: normalizePixabay,
  twitch: normalizeTwitch,
  goodgame: normalizeGoodgame,
  vkvideo: normalizeFeed,
  bilibili: normalizeFeed,
  rumble: normalizeFeed,
  generic: normalizeFeed,
};

/** URL fields checked by `validate`, with the message naming each in errors. */
const URL_FIELD_LABELS: readonly (readonly [
  "instanceUrl" | "channelUrl" | "feedUrl",
  MessageKey,
])[] = [
  ["instanceUrl", "field-instance-url"],
  ["channelUrl", "field-channel-url"],
  ["feedUrl", "field-feed-url"],
];

function validate(subscription: Subscription): string[] {
  const errors: string[] = [];
  const platform = getPlatform(subscription.platform);

  if (platform.requiresInstance && !subscription.instanceUrl) {
    errors.push(t("validate-instance-required", { platform: platform.label }));
  }

  if (!subscription.channelId && !isFeedOnlyPlatform(subscription.platform)) {
    errors.push(t("validate-channel-required"));
  }

  if (platform.requiresFeedUrl && !subscription.feedUrl) {
    errors.push(t("validate-feed-required"));
  }

  for (const [field, labelId] of URL_FIELD_LABELS) {
    const value = subscription[field];
    if (value && !parseHttpUrl(value)) {
      errors.push(t("validate-invalid-url", { field: t(labelId) }));
    }
    if (value.length > MAX_URL_LENGTH) {
      errors.push(t("validate-url-too-long", { field: t(labelId) }));
    }
  }

  if (subscription.channelId.length > MAX_NAME_LENGTH) {
    errors.push(t("validate-channel-too-long"));
  }

  return errors;
}

export type NormalizeResult =
  { subscription: Subscription; errors: [] } | { subscription: null; errors: string[] };

/** Validates and canonicalizes a subscription from any supported input shape. */
export function normalizeSubscription(raw: RawSubscription): NormalizeResult {
  const platform = parsePlatform(raw);
  if (!platform) {
    return { subscription: null, errors: [t("validate-unknown-platform")] };
  }

  const input: SubscriptionInput = {
    channelId: textOf(raw, "channelId"),
    channelUrl: textOf(raw, "channelUrl"),
    instanceUrl: textOf(raw, "instanceUrl"),
    feedUrl: textOf(raw, "feedUrl"),
  };
  const derived = NORMALIZERS[platform](input);

  const channelId = derived.channelId ?? input.channelId;
  const instanceUrl =
    normalizeBaseUrl(derived.instanceUrl ?? input.instanceUrl) ||
    getPlatform(platform).defaultInstanceUrl;

  const subscription: Subscription = {
    platform,
    instanceUrl,
    channelId,
    channelName:
      textOf(raw, "channelName").slice(0, MAX_NAME_LENGTH) ||
      channelId ||
      hostKey(instanceUrl) ||
      "Subscription",
    channelUrl: normalizeUrl(derived.channelUrl ?? input.channelUrl),
    feedUrl: normalizeUrl(derived.feedUrl ?? input.feedUrl),
    enabled: parseEnabled(valueOf(raw, "enabled")),
  };

  const errors = validate(subscription);
  return errors.length === 0 ? { subscription, errors: [] } : { subscription: null, errors };
}

/** Identity of a subscription: platform, host, channel, and feed. */
export function subscriptionKey(subscription: Subscription): string {
  const host = hostKey(subscription.instanceUrl) || hostKey(subscription.feedUrl);
  const channel = subscription.channelId.trim();
  const feed = normalizeUrl(subscription.feedUrl);
  return [subscription.platform, host, channel, feed].join("|");
}

export function dedupeSubscriptions(subscriptions: readonly Subscription[]): Subscription[] {
  const byKey = new Map<string, Subscription>();
  for (const subscription of subscriptions) {
    const key = subscriptionKey(subscription);
    if (!byKey.has(key)) {
      byKey.set(key, subscription);
    }
  }
  return [...byKey.values()];
}

export type MergeMode = "merge" | "skip" | "replace";

export function isMergeMode(value: unknown): value is MergeMode {
  return value === "merge" || value === "skip" || value === "replace";
}

/**
 * Combines imported subscriptions with existing ones.
 * - `replace`: keep only the (deduplicated) incoming list.
 * - `skip`: add new subscriptions, leave duplicates untouched.
 * - `merge`: add new subscriptions and update duplicates' metadata, keeping their enabled state.
 */
export function mergeSubscriptions(
  existing: readonly Subscription[],
  incoming: readonly Subscription[],
  mode: MergeMode = "merge"
): Subscription[] {
  const nextIncoming = dedupeSubscriptions(incoming);
  if (mode === "replace") {
    return nextIncoming;
  }

  const result = [...existing];
  const indexByKey = new Map(
    result.map((subscription, index) => [subscriptionKey(subscription), index])
  );

  for (const subscription of nextIncoming) {
    const key = subscriptionKey(subscription);
    const existingIndex = indexByKey.get(key);
    const previous = existingIndex === undefined ? undefined : result[existingIndex];

    if (existingIndex === undefined || !previous) {
      indexByKey.set(key, result.length);
      result.push(subscription);
    } else if (mode === "merge") {
      result[existingIndex] = {
        ...previous,
        ...subscription,
        channelName: subscription.channelName || previous.channelName,
        enabled: previous.enabled,
      };
    }
  }

  return result;
}
