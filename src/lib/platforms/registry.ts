import { t } from "../i18n/index.js";
import type { InstanceKind, PlatformAdapter, PlatformId, PlatformKind } from "../types.js";
import { DAILYMOTION_ORIGIN, dailymotionAdapter } from "./dailymotion.js";
import { DTUBE_API, DTUBE_ORIGIN, dtubeAdapter } from "./dtube.js";
import { genericRssAdapter } from "./generic-rss.js";
import { GOODGAME_ORIGIN, goodgameAdapter } from "./goodgame.js";
import { ODYSEE_ORIGIN, odyseeAdapter } from "./odysee.js";
import { peertubeAdapter } from "./peertube.js";
import { PIXABAY_CACHE_MS, PIXABAY_ORIGIN, pixabayAdapter } from "./pixabay.js";
import { RUTUBE_ORIGIN, rutubeAdapter } from "./rutube.js";
import { TWITCH_ORIGIN, twitchAdapter } from "./twitch.js";
import { YOUTUBE_ORIGIN } from "./youtube-urls.js";
import { youtubeAdapter } from "./youtube.js";

export interface PlatformDefinition {
  readonly label: string;
  readonly kind: PlatformKind;
  readonly adapter: PlatformAdapter;
  /** Instance used when a subscription does not name one. */
  readonly defaultInstanceUrl: string;
  /** Fixed host permission; empty when it depends on the subscription's own URL. */
  readonly permissionOrigin: string;
  readonly requiresInstance: boolean;
  readonly requiresFeedUrl: boolean;
  /** Kind of configured instance offered in the subscription form, if any. */
  readonly instanceKind: InstanceKind | null;
  /** Minimum time between successful fetches, when the platform asks for more than the default. */
  readonly refreshCooldownMs?: number;
  /** An RSS bridge feed URL may be given instead of the platform's own API (optional). */
  readonly allowsFeedUrl?: boolean;
}

function nativePlatform(
  label: string,
  origin: string,
  adapter: PlatformAdapter
): PlatformDefinition {
  return {
    label,
    kind: "native",
    adapter,
    defaultInstanceUrl: origin,
    permissionOrigin: `${origin}/*`,
    requiresInstance: false,
    requiresFeedUrl: false,
    instanceKind: null,
  };
}

function feedPlatform(
  label: string,
  kind: Exclude<PlatformKind, "native">,
  instanceKind: InstanceKind
): PlatformDefinition {
  return {
    label,
    kind,
    adapter: genericRssAdapter,
    defaultInstanceUrl: "",
    permissionOrigin: "",
    requiresInstance: false,
    requiresFeedUrl: true,
    instanceKind,
  };
}

export const PLATFORMS = {
  youtube: nativePlatform("YouTube", YOUTUBE_ORIGIN, youtubeAdapter),
  peertube: {
    label: "PeerTube",
    kind: "native",
    adapter: peertubeAdapter,
    defaultInstanceUrl: "",
    permissionOrigin: "",
    requiresInstance: true,
    requiresFeedUrl: false,
    instanceKind: "peertube",
  },
  odysee: nativePlatform("Odysee", ODYSEE_ORIGIN, odyseeAdapter),
  rutube: nativePlatform("Rutube", RUTUBE_ORIGIN, rutubeAdapter),
  dailymotion: nativePlatform("Dailymotion", DAILYMOTION_ORIGIN, dailymotionAdapter),
  dtube: {
    ...nativePlatform("D.Tube", DTUBE_ORIGIN, dtubeAdapter),
    // Videos are read from the API host, not the website.
    permissionOrigin: `${DTUBE_API}/*`,
  },
  pixabay: {
    ...nativePlatform("Pixabay", PIXABAY_ORIGIN, pixabayAdapter),
    // Pixabay's API terms ask for results to be cached for 24 hours.
    refreshCooldownMs: PIXABAY_CACHE_MS,
  },
  twitch: {
    ...nativePlatform("Twitch", TWITCH_ORIGIN, twitchAdapter),
    // Helix API host; a subscription with a bridge feed URL uses the feed's host instead.
    permissionOrigin: "https://api.twitch.tv/*",
    allowsFeedUrl: true,
  },
  goodgame: nativePlatform("GoodGame", GOODGAME_ORIGIN, goodgameAdapter),
  vkvideo: feedPlatform("VK Video", "bridge", "vk"),
  bilibili: feedPlatform("Bilibili", "bridge", "bilibili"),
  rumble: feedPlatform("Rumble", "bridge", "rumble"),
  generic: feedPlatform("RSS / Atom", "generic", "generic"),
} as const satisfies Record<PlatformId, PlatformDefinition>;

export const PLATFORM_IDS = Object.keys(PLATFORMS) as PlatformId[];

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === "string" && Object.hasOwn(PLATFORMS, value);
}

export function getPlatform(platform: string): PlatformDefinition {
  return isPlatformId(platform) ? PLATFORMS[platform] : PLATFORMS.generic;
}

export function platformLabel(platform: string): string {
  return getPlatform(platform).label;
}

/** Platforms read through a bridge or arbitrary feed, where a channel id is optional. */
export function isFeedOnlyPlatform(platform: string): boolean {
  return getPlatform(platform).kind !== "native";
}

/** Placeholder text for the subscription form channel input, in the interface language. */
export function channelPlaceholder(platform: PlatformId): string {
  return t(`placeholder-${platform}`);
}

export const INSTANCE_KINDS: readonly InstanceKind[] = [
  "peertube",
  "rsshub",
  "vk",
  "bilibili",
  "rumble",
  "generic",
];

/** Display name of an instance kind, in the interface language. */
export function instanceKindLabel(kind: InstanceKind): string {
  return t(`inst-kind-${kind}`);
}

export function isInstanceKind(value: unknown): value is InstanceKind {
  return INSTANCE_KINDS.includes(value as InstanceKind);
}

/** Instance kinds a subscription of `kind` may use: bridges also accept RSSHub bases. */
export function compatibleInstanceKinds(kind: InstanceKind): readonly InstanceKind[] {
  return kind === "peertube" || kind === "rsshub" ? [kind] : [kind, "rsshub"];
}
