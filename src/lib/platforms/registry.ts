import type { InstanceKind, PlatformAdapter, PlatformId, PlatformKind } from "../types.js";
import { DAILYMOTION_ORIGIN, dailymotionAdapter } from "./dailymotion.js";
import { DTUBE_API, DTUBE_ORIGIN, dtubeAdapter } from "./dtube.js";
import { genericRssAdapter } from "./generic-rss.js";
import { ODYSEE_ORIGIN, odyseeAdapter } from "./odysee.js";
import { peertubeAdapter } from "./peertube.js";
import { PIXABAY_CACHE_MS, PIXABAY_ORIGIN, pixabayAdapter } from "./pixabay.js";
import { RUTUBE_ORIGIN, rutubeAdapter } from "./rutube.js";
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
  /** Placeholder for the channel input of the subscription form. */
  readonly placeholder: string;
  /** Minimum time between successful fetches, when the platform asks for more than the default. */
  readonly refreshCooldownMs?: number;
}

function nativePlatform(
  label: string,
  origin: string,
  adapter: PlatformAdapter,
  placeholder: string
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
    placeholder,
  };
}

function feedPlatform(
  label: string,
  kind: Exclude<PlatformKind, "native">,
  instanceKind: InstanceKind,
  placeholder: string
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
    placeholder,
  };
}

export const PLATFORMS = {
  youtube: nativePlatform("YouTube", YOUTUBE_ORIGIN, youtubeAdapter, "UC… / channel URL / @handle"),
  peertube: {
    label: "PeerTube",
    kind: "native",
    adapter: peertubeAdapter,
    defaultInstanceUrl: "",
    permissionOrigin: "",
    requiresInstance: true,
    requiresFeedUrl: false,
    instanceKind: "peertube",
    placeholder: "Channel handle or /c/ URL",
  },
  odysee: nativePlatform("Odysee", ODYSEE_ORIGIN, odyseeAdapter, "@name:claimid"),
  rutube: nativePlatform("Rutube", RUTUBE_ORIGIN, rutubeAdapter, "Numeric channel ID or URL"),
  dailymotion: nativePlatform(
    "Dailymotion",
    DAILYMOTION_ORIGIN,
    dailymotionAdapter,
    "Username or channel URL"
  ),
  dtube: {
    ...nativePlatform("D.Tube", DTUBE_ORIGIN, dtubeAdapter, "Channel name or d.tube/channel/… URL"),
    // Videos are read from the API host, not the website.
    permissionOrigin: `${DTUBE_API}/*`,
  },
  pixabay: {
    ...nativePlatform("Pixabay", PIXABAY_ORIGIN, pixabayAdapter, "Contributor name or profile URL"),
    // Pixabay's API terms ask for results to be cached for 24 hours.
    refreshCooldownMs: PIXABAY_CACHE_MS,
  },
  vkvideo: feedPlatform("VK Video", "bridge", "vk", "Optional channel ID"),
  bilibili: feedPlatform("Bilibili", "bridge", "bilibili", "Optional UID"),
  rumble: feedPlatform("Rumble", "bridge", "rumble", "Optional channel slug"),
  generic: feedPlatform("RSS / Atom", "generic", "generic", "Optional channel ID"),
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

export const INSTANCE_KIND_LABELS: Readonly<Record<InstanceKind, string>> = {
  peertube: "PeerTube",
  rsshub: "RSSHub",
  vk: "VK bridge",
  bilibili: "Bilibili bridge",
  rumble: "Rumble bridge",
  generic: "Generic RSS",
};

export function isInstanceKind(value: unknown): value is InstanceKind {
  return typeof value === "string" && Object.hasOwn(INSTANCE_KIND_LABELS, value);
}

/** Instance kinds a subscription of `kind` may use: bridges also accept RSSHub bases. */
export function compatibleInstanceKinds(kind: InstanceKind): readonly InstanceKind[] {
  return kind === "peertube" || kind === "rsshub" ? [kind] : [kind, "rsshub"];
}
