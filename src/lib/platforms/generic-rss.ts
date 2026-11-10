import { LocalizedError } from "../errors.js";
import { decodeHtmlEntities } from "../text.js";
import { toIsoString } from "../time.js";
import type { AdapterContext, FeedItem, PlatformAdapter, Subscription } from "../types.js";
import { parseHttpUrl, resolveUrl } from "../url.js";
import { firstAttribute, firstText, parseXml } from "../xml.js";
import { createFeedItem, isFeedItem } from "./feed-item.js";

const FEED_ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5";
const IMAGE_IN_MARKUP = /<img[^>]+src=["']([^"']+)["']/i;

function firstLink(node: Element): string {
  const links = Array.from(node.getElementsByTagName("link"));
  const alternate = links.find((link) => {
    const rel = link.getAttribute("rel");
    return !rel || rel === "alternate";
  });
  const chosen = alternate ?? links[0];
  return chosen?.getAttribute("href")?.trim() || chosen?.textContent.trim() || "";
}

function firstImageUrl(
  elements: HTMLCollectionOf<Element>,
  isImage: (element: Element) => boolean
): string {
  for (const element of Array.from(elements)) {
    const url = element.getAttribute("url");
    if (url && isImage(element)) {
      return url;
    }
  }
  return "";
}

function extractThumbnail(node: Element, base: string): string {
  const candidate =
    firstAttribute(node, ["media:thumbnail", "itunes:image"], "url") ||
    firstImageUrl(
      node.getElementsByTagName("media:content"),
      (element) =>
        (element.getAttribute("type") ?? "").startsWith("image/") ||
        element.getAttribute("medium") === "image"
    ) ||
    firstImageUrl(node.getElementsByTagName("enclosure"), (element) =>
      (element.getAttribute("type") ?? "").startsWith("image/")
    ) ||
    (IMAGE_IN_MARKUP.exec(
      firstText(node, ["content:encoded", "description", "summary", "content"])
    )?.[1] ??
      "");

  return resolveUrl(candidate, base);
}

function buildItem(node: Element, subscription: Subscription, base: string): FeedItem | null {
  const guid = firstText(node, ["guid", "id"]);
  const url = resolveUrl(firstLink(node) || guid, base);

  return createFeedItem(subscription, {
    id: guid || url,
    title: decodeHtmlEntities(firstText(node, ["title"])),
    url,
    thumbnailUrl: extractThumbnail(node, base),
    publishedAt: toIsoString(firstText(node, ["published", "pubDate", "updated", "dc:date"])),
  });
}

/** Parses RSS 2.0 `<item>`s or, if there are none, Atom `<entry>`s. */
export function parseSyndicationFeed(
  xmlText: string,
  subscription: Subscription,
  feedUrl: string
): FeedItem[] {
  const document = parseXml(xmlText, "rss-invalid-xml");
  const base = feedUrl || subscription.feedUrl || subscription.instanceUrl;
  const rssItems = Array.from(document.getElementsByTagName("item"));
  const nodes = rssItems.length > 0 ? rssItems : Array.from(document.getElementsByTagName("entry"));

  return nodes.map((node) => buildItem(node, subscription, base)).filter(isFeedItem);
}

/** Fetches and parses the RSS/Atom feed at `feedUrl`. */
export async function fetchFeedItems(
  subscription: Subscription,
  feedUrl: string,
  context: AdapterContext
): Promise<FeedItem[]> {
  if (!parseHttpUrl(feedUrl)) {
    throw new LocalizedError("rss-needs-feed");
  }

  const xml = await context.fetchText(feedUrl, {
    timeoutMs: context.timeoutMs,
    accept: FEED_ACCEPT,
  });

  return parseSyndicationFeed(xml, subscription, feedUrl).slice(0, context.itemsPerSource);
}

/** Adapter for platforms whose videos are read from an RSS/Atom feed URL. */
export function createFeedAdapter(
  feedUrlFor: (subscription: Subscription) => string
): PlatformAdapter {
  return {
    feedUrlFor,
    fetchItems: (subscription, context) =>
      fetchFeedItems(subscription, feedUrlFor(subscription), context),
  };
}

export const genericRssAdapter = createFeedAdapter((subscription) => subscription.feedUrl);
