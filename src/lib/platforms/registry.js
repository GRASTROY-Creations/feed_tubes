import * as dailymotion from "./dailymotion.js";
import * as genericRss from "./generic-rss.js";
import * as odysee from "./odysee.js";
import * as peertube from "./peertube.js";
import * as rutube from "./rutube.js";
import * as youtube from "./youtube.js";

export const PLATFORMS = {
  youtube: {
    label: "YouTube",
    defaultInstanceUrl: "https://www.youtube.com",
    kind: "native",
    permissionOrigin: "https://www.youtube.com/*",
  },
  peertube: {
    label: "PeerTube",
    defaultInstanceUrl: "",
    kind: "native",
    permissionOrigin: "",
    requiresInstance: true,
  },
  odysee: {
    label: "Odysee",
    defaultInstanceUrl: "https://odysee.com",
    kind: "native",
    permissionOrigin: "https://odysee.com/*",
  },
  rutube: {
    label: "Rutube",
    defaultInstanceUrl: "https://rutube.ru",
    kind: "native",
    permissionOrigin: "https://rutube.ru/*",
  },
  dailymotion: {
    label: "Dailymotion",
    defaultInstanceUrl: "https://www.dailymotion.com",
    kind: "native",
    permissionOrigin: "https://www.dailymotion.com/*",
  },
  vkvideo: {
    label: "VK Video",
    defaultInstanceUrl: "",
    kind: "bridge",
    permissionOrigin: "",
    requiresFeedUrl: true,
  },
  bilibili: {
    label: "Bilibili",
    defaultInstanceUrl: "",
    kind: "bridge",
    permissionOrigin: "",
    requiresFeedUrl: true,
  },
  rumble: {
    label: "Rumble",
    defaultInstanceUrl: "",
    kind: "bridge",
    permissionOrigin: "",
    requiresFeedUrl: true,
  },
  generic: {
    label: "RSS / Atom",
    defaultInstanceUrl: "",
    kind: "generic",
    permissionOrigin: "",
    requiresFeedUrl: true,
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS);
export const BRIDGE_PLATFORMS = new Set(["vkvideo", "bilibili", "rumble", "generic"]);
export const DEFAULT_ITEMS_PER_SOURCE = 20;

const ADAPTERS = {
  youtube,
  peertube,
  odysee,
  rutube,
  dailymotion,
  vkvideo: genericRss,
  bilibili: genericRss,
  rumble: genericRss,
  generic: genericRss,
};

export function getPlatform(platform) {
  return PLATFORMS[platform] || PLATFORMS.generic;
}

export function platformLabel(platform) {
  return getPlatform(platform).label;
}

export function getAdapter(platform) {
  return ADAPTERS[platform] || genericRss;
}

export function defaultInstanceUrl(platform) {
  return getPlatform(platform).defaultInstanceUrl || "";
}

export function requiresFeedUrl(platform) {
  return Boolean(getPlatform(platform).requiresFeedUrl);
}
