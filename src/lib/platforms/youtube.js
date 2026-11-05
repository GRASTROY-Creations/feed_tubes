import { decodeHtmlEntities, extractYouTubeChannelId, parseHttpUrl } from "../url.js";
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

function feedUrlFor(subscription) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
    subscription.channelId
  )}`;
}

export async function resolveYouTubeChannel(input, context) {
  const value = String(input || "").trim();
  const directId = extractYouTubeChannelId(value);
  if (directId) {
    return {
      channelId: directId,
      channelName: "",
      channelUrl: `https://www.youtube.com/channel/${directId}`,
    };
  }

  if (!value.startsWith("@")) {
    throw new Error("Enter a YouTube channel ID (UC…), /channel/UC… URL, or @handle.");
  }

  const channelUrl = `https://www.youtube.com/${encodeURIComponent(value).replace("%40", "@")}`;
  const html = await context.fetchText(channelUrl, {
    timeoutMs: context.timeoutMs,
    accept: "text/html",
  });

  const patterns = [
    /"channelId":"(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
    /<meta itemprop="identifier" content="(UC[\w-]{22})"/,
    /channel_id=(UC[\w-]{22})/,
    /\/channel\/(UC[\w-]{22})/,
  ];

  let channelId = "";
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      channelId = match[1];
      break;
    }
  }

  if (!channelId) {
    throw new Error("Could not resolve that YouTube handle. Enter the UC… channel ID instead.");
  }

  const titleMatch = /<meta property="og:title" content="([^"]*)"/i.exec(html);
  return {
    channelId,
    channelName: titleMatch ? decodeHtmlEntities(titleMatch[1]) : "",
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
  };
}

export async function fetchItems(subscription, context) {
  if (!/^UC[\w-]{22}$/.test(subscription.channelId)) {
    throw new Error("The YouTube channel ID is not resolved.");
  }

  const feedUrl = feedUrlFor(subscription);
  const xml = await context.fetchText(feedUrl, {
    timeoutMs: context.timeoutMs,
    accept: "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
  });

  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("The YouTube feed is not valid XML.");
  }

  const entries = Array.from(document.getElementsByTagName("entry"));
  return entries
    .map((entry) => {
      const videoId =
        firstText(entry, ["yt:videoId"]) || firstText(entry, ["id"]).replace(/^yt:video:/, "");
      const title = decodeHtmlEntities(firstText(entry, ["title"])).slice(0, 500);
      const links = Array.from(entry.getElementsByTagName("link"));
      const link =
        links.find((element) => element.getAttribute("rel") === "alternate") || links[0] || null;
      const url = link?.getAttribute("href")?.trim() || "";
      const thumbnailElement = entry.getElementsByTagName("media:thumbnail")[0] || null;
      const thumbnailUrl = thumbnailElement?.getAttribute("url")?.trim() || "";
      const publishedAt = toIsoString(firstText(entry, ["published", "updated"]));

      if (!videoId || !title || !parseHttpUrl(url)) {
        return null;
      }

      return {
        id: `youtube:${videoId}`,
        platform: subscription.platform,
        channelId: subscription.channelId,
        channelName: subscription.channelName || subscription.channelId,
        title,
        url,
        thumbnailUrl,
        publishedAt,
      };
    })
    .filter((item) => item !== null)
    .slice(0, context.itemsPerSource);
}
