import { decodeHtmlEntities, normalizeUrl, parseHttpUrl } from "../url.js";
import { toIsoString } from "../time.js";

function firstText(node, names) {
  for (const name of names) {
    const elements = node.getElementsByTagName(name);
    if (elements.length > 0) {
      const value = elements[0].textContent?.trim();
      if (value) {
        return value;
      }
    }
  }
  return "";
}

function firstAttribute(node, names, attribute) {
  for (const name of names) {
    const elements = node.getElementsByTagName(name);
    for (const element of elements) {
      const value = element.getAttribute(attribute)?.trim();
      if (value) {
        return value;
      }
    }
  }
  return "";
}

function resolveUrl(value, base) {
  if (!value) {
    return "";
  }

  try {
    const resolved = new URL(value, base);
    return normalizeUrl(resolved.href);
  } catch {
    return "";
  }
}

function firstLink(node) {
  const links = Array.from(node.getElementsByTagName("link"));
  if (links.length === 0) {
    return "";
  }

  const alternate = links.find((link) => {
    const rel = link.getAttribute("rel");
    return !rel || rel === "alternate";
  });

  const chosen = alternate || links[0];
  return chosen.getAttribute("href")?.trim() || chosen.textContent?.trim() || "";
}

function extractImageFromMarkup(value) {
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(String(value || ""));
  return match ? match[1] : "";
}

function extractThumbnail(node, base) {
  const direct = firstAttribute(node, ["media:thumbnail", "itunes:image"], "url");
  if (direct) {
    return resolveUrl(direct, base);
  }

  const content = Array.from(node.getElementsByTagName("media:content"));
  for (const element of content) {
    const type = element.getAttribute("type") || "";
    const medium = element.getAttribute("medium") || "";
    if (type.startsWith("image/") || medium === "image") {
      const value = element.getAttribute("url");
      if (value) {
        return resolveUrl(value, base);
      }
    }
  }

  const enclosure = Array.from(node.getElementsByTagName("enclosure"));
  for (const element of enclosure) {
    if ((element.getAttribute("type") || "").startsWith("image/")) {
      const value = element.getAttribute("url");
      if (value) {
        return resolveUrl(value, base);
      }
    }
  }

  const markup = firstText(node, ["content:encoded", "description", "summary", "content"]);
  return resolveUrl(extractImageFromMarkup(markup), base);
}

function publishedValue(node) {
  return firstText(node, ["published", "pubDate", "updated", "dc:date"]);
}

function buildItem(node, subscription, base) {
  const title = decodeHtmlEntities(firstText(node, ["title"])).slice(0, 500);
  const rawUrl = firstLink(node) || firstText(node, ["guid", "id"]);
  const url = resolveUrl(rawUrl, base);
  if (!url || !title) {
    return null;
  }

  const rawId = firstText(node, ["guid", "id"]);
  return {
    id: rawId || url,
    platform: subscription.platform,
    channelId: subscription.channelId,
    channelName: subscription.channelName || subscription.channelId,
    title,
    url,
    thumbnailUrl: extractThumbnail(node, base),
    publishedAt: toIsoString(publishedValue(node)),
  };
}

export function parseSyndicationFeed(xmlText, subscription, feedUrl) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xmlText, "application/xml");
  const parseError = document.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("The feed is not valid XML.");
  }

  const base = feedUrl || subscription.feedUrl || subscription.instanceUrl;
  const rssItems = Array.from(document.getElementsByTagName("item"));
  const atomEntries = Array.from(document.getElementsByTagName("entry"));
  const nodes = rssItems.length > 0 ? rssItems : atomEntries;

  return nodes.map((node) => buildItem(node, subscription, base)).filter((item) => item !== null);
}

export async function fetchItems(subscription, context) {
  const feedUrl = subscription.feedUrl || "";
  if (!parseHttpUrl(feedUrl)) {
    throw new Error("This subscription needs a valid RSS or Atom feed URL.");
  }

  const xml = await context.fetchText(feedUrl, {
    timeoutMs: context.timeoutMs,
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
  });

  return parseSyndicationFeed(xml, subscription, feedUrl).slice(0, context.itemsPerSource);
}
