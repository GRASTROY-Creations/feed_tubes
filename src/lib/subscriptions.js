import { hostKey, normalizeBaseUrl, normalizeUrl, parseHttpUrl } from "./url.js";
import {
  BRIDGE_PLATFORMS,
  PLATFORM_IDS,
  defaultInstanceUrl,
  getPlatform,
  requiresFeedUrl,
} from "./platforms/registry.js";

const MAX_NAME_LENGTH = 300;
const MAX_URL_LENGTH = 4096;

function valueOf(raw, ...names) {
  for (const name of names) {
    if (raw[name] !== undefined && raw[name] !== null) {
      return raw[name];
    }
  }
  return "";
}

function textOf(raw, ...names) {
  return String(valueOf(raw, ...names)).trim();
}

function normalizePlatform(value) {
  const platform = String(value || "")
    .trim()
    .toLowerCase();
  return PLATFORM_IDS.includes(platform) ? platform : "";
}

function parseEnabled(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  const text = String(value).trim().toLowerCase();
  return !["false", "0", "no", "off", "disabled"].includes(text);
}

function extractHandle(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const url = parseHttpUrl(text);
  if (!url) {
    return text;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length > 0 ? decodeURIComponent(segments[0]) : "";
}

function normalizeYouTube(raw) {
  let channelId = textOf(raw, "channelId", "channel_id", "channelid", "id");
  const channelUrlInput = textOf(raw, "channelUrl", "channel_url", "channelurl", "url");
  let channelUrl = normalizeUrl(channelUrlInput);

  const url = parseHttpUrl(channelUrlInput) || parseHttpUrl(channelId);
  if (url && /(^|\.)youtube\.com$/i.test(url.hostname)) {
    const channelMatch = /^\/channel\/(UC[\w-]{22})/.exec(url.pathname);
    if (channelMatch) {
      channelId = channelMatch[1];
    } else {
      const handleMatch = /^\/@([^/]+)/.exec(url.pathname);
      if (handleMatch) {
        channelId = `@${handleMatch[1]}`;
      }
    }
  }

  if (!channelId && channelUrl) {
    channelId = channelUrl;
  }

  if (channelId && !channelUrl) {
    channelUrl = channelId.startsWith("@")
      ? `https://www.youtube.com/${encodeURIComponent(channelId).replace("%40", "@")}`
      : `https://www.youtube.com/channel/${channelId}`;
  }

  return { channelId, channelUrl };
}

function normalizePeerTube(raw) {
  let instanceUrl = normalizeBaseUrl(textOf(raw, "instanceUrl", "instance_url", "instanceurl"));
  let channelId = textOf(raw, "channelId", "channel_id", "channelid", "id");
  let channelUrl = normalizeUrl(textOf(raw, "channelUrl", "channel_url", "channelurl", "url"));

  const url = parseHttpUrl(channelUrl) || parseHttpUrl(channelId);
  if (url) {
    if (!instanceUrl) {
      instanceUrl = `${url.protocol}//${url.host}`;
    }
    const match = /^\/(?:c|video-channels)\/([^/]+)/.exec(url.pathname);
    if (match) {
      channelId = decodeURIComponent(match[1]);
    }
  }

  if (!instanceUrl) {
    instanceUrl = defaultInstanceUrl("peertube");
  }

  if (!channelUrl && instanceUrl && channelId) {
    channelUrl = `${instanceUrl.replace(/\/$/, "")}/c/${encodeURIComponent(channelId)}`;
  }

  return { instanceUrl, channelId, channelUrl };
}

function normalizeOdysee(raw) {
  let channelId = textOf(raw, "channelId", "channel_id", "channelid", "id");
  let channelUrl = normalizeUrl(textOf(raw, "channelUrl", "channel_url", "channelurl", "url"));

  const url = parseHttpUrl(channelUrl) || parseHttpUrl(channelId);
  if (url && /(^|\.)odysee\.com$/i.test(url.hostname)) {
    channelId = extractHandle(url.href) || channelId;
    channelUrl = url.href;
  }

  if (!channelUrl && channelId) {
    channelUrl = `https://odysee.com/${channelId.replace(/^@?/, "@")}`;
  }

  return { channelId, channelUrl };
}

function normalizeRutube(raw) {
  let channelId = textOf(raw, "channelId", "channel_id", "channelid", "id");
  const channelUrlInput = textOf(raw, "channelUrl", "channel_url", "channelurl", "url");
  let channelUrl = normalizeUrl(channelUrlInput);

  const url = parseHttpUrl(channelUrlInput) || parseHttpUrl(channelId);
  if (url) {
    const match = /\/channel\/(\d+)/.exec(url.pathname);
    if (match) {
      channelId = match[1];
    }
  }

  if (!channelUrl && /^\d+$/.test(channelId)) {
    channelUrl = `https://rutube.ru/channel/${channelId}/`;
  }

  return { channelId, channelUrl };
}

function normalizeDailymotion(raw) {
  let channelId = textOf(raw, "channelId", "channel_id", "channelid", "id");
  const channelUrlInput = textOf(raw, "channelUrl", "channel_url", "channelurl", "url");
  let channelUrl = normalizeUrl(channelUrlInput);

  const url = parseHttpUrl(channelUrlInput) || parseHttpUrl(channelId);
  if (url) {
    const userMatch = /\/user\/([^/]+)/.exec(url.pathname);
    if (userMatch) {
      channelId = decodeURIComponent(userMatch[1]);
    } else {
      channelId = extractHandle(url.href) || channelId;
    }
  }

  if (!channelUrl && channelId) {
    channelUrl = `https://www.dailymotion.com/${encodeURIComponent(channelId)}`;
  }

  return { channelId, channelUrl };
}

function normalizeGeneric(raw) {
  let feedUrl = normalizeUrl(textOf(raw, "feedUrl", "feed_url", "feedurl", "rssUrl", "rss_url"));
  let instanceUrl = normalizeBaseUrl(textOf(raw, "instanceUrl", "instance_url", "instanceurl"));
  let channelUrl = normalizeUrl(textOf(raw, "channelUrl", "channel_url", "channelurl", "url"));
  const channelId = textOf(raw, "channelId", "channel_id", "channelid", "id");

  if (!feedUrl && parseHttpUrl(channelUrl)) {
    feedUrl = channelUrl;
  }

  if (!instanceUrl && feedUrl) {
    const url = parseHttpUrl(feedUrl);
    if (url) {
      instanceUrl = `${url.protocol}//${url.host}`;
    }
  }

  if (!channelUrl) {
    channelUrl = feedUrl;
  }

  return { feedUrl, instanceUrl, channelUrl, channelId };
}

export function normalizeSubscription(raw) {
  const errors = [];
  const platform = normalizePlatform(valueOf(raw, "platform", "Platform"));

  if (!platform) {
    return {
      subscription: null,
      errors: ["Unknown or missing platform."],
    };
  }

  const base = {
    platform,
    instanceUrl: normalizeBaseUrl(textOf(raw, "instanceUrl", "instance_url", "instanceurl")),
    channelId: textOf(raw, "channelId", "channel_id", "channelid", "id"),
    channelName: textOf(raw, "channelName", "channel_name", "channelname", "name", "title").slice(
      0,
      MAX_NAME_LENGTH
    ),
    channelUrl: normalizeUrl(textOf(raw, "channelUrl", "channel_url", "channelurl", "url")),
    feedUrl: normalizeUrl(textOf(raw, "feedUrl", "feed_url", "feedurl", "rssUrl", "rss_url")),
    enabled: parseEnabled(valueOf(raw, "enabled", "Enabled")),
  };

  let derived;
  switch (platform) {
    case "youtube":
      derived = normalizeYouTube(raw);
      break;
    case "peertube":
      derived = normalizePeerTube(raw);
      break;
    case "odysee":
      derived = normalizeOdysee(raw);
      break;
    case "rutube":
      derived = normalizeRutube(raw);
      break;
    case "dailymotion":
      derived = normalizeDailymotion(raw);
      break;
    default:
      derived = normalizeGeneric(raw);
      break;
  }

  const subscription = { ...base, ...derived };
  subscription.instanceUrl = normalizeBaseUrl(subscription.instanceUrl);
  if (!subscription.instanceUrl) {
    subscription.instanceUrl = defaultInstanceUrl(platform);
  }
  subscription.channelUrl = normalizeUrl(subscription.channelUrl);
  subscription.feedUrl = normalizeUrl(subscription.feedUrl);

  if (!subscription.channelName) {
    subscription.channelName =
      subscription.channelId || hostKey(subscription.instanceUrl) || "Subscription";
  }

  if (getPlatform(platform).requiresInstance && !subscription.instanceUrl) {
    errors.push("A PeerTube instance URL is required.");
  }

  if (!subscription.channelId && !BRIDGE_PLATFORMS.has(platform)) {
    errors.push("A channel ID or channel URL is required.");
  }

  if (requiresFeedUrl(platform) && !subscription.feedUrl) {
    errors.push("This platform needs an RSS/Atom or bridge feed URL.");
  }

  for (const [field, value] of [
    ["instanceUrl", subscription.instanceUrl],
    ["channelUrl", subscription.channelUrl],
    ["feedUrl", subscription.feedUrl],
  ]) {
    if (value && !parseHttpUrl(value)) {
      errors.push(`${field} must be a valid http(s) URL.`);
    } else if (value.length > MAX_URL_LENGTH) {
      errors.push(`${field} is too long.`);
    }
  }

  if (subscription.channelId.length > MAX_NAME_LENGTH) {
    errors.push("The channel identifier is too long.");
  }

  return { subscription: errors.length === 0 ? subscription : null, errors };
}

export function validateSubscription(subscription) {
  return normalizeSubscription(subscription).errors;
}

export function subscriptionKey(subscription) {
  const host = hostKey(subscription.instanceUrl) || hostKey(subscription.feedUrl);
  const channel = String(subscription.channelId || "").trim();
  const feed = normalizeUrl(subscription.feedUrl);
  return [subscription.platform, host, channel, feed].join("|");
}

export function dedupeSubscriptions(subscriptions) {
  const seen = new Set();
  const result = [];
  for (const subscription of subscriptions) {
    const key = subscriptionKey(subscription);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(subscription);
  }
  return result;
}

export function mergeSubscriptions(existing, incoming, mode = "merge") {
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

    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push(subscription);
      continue;
    }

    if (mode === "merge") {
      const previous = result[existingIndex];
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

export function instanceKindForPlatform(platform) {
  if (platform === "peertube") {
    return "peertube";
  }
  if (platform === "vkvideo") {
    return "vk";
  }
  if (platform === "bilibili") {
    return "bilibili";
  }
  if (platform === "rumble") {
    return "rumble";
  }
  if (platform === "generic") {
    return "generic";
  }
  return "";
}

export function isBridgePlatform(platform) {
  return BRIDGE_PLATFORMS.has(platform);
}
