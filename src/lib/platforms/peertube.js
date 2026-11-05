import { normalizeUrl, parseHttpUrl } from "../url.js";
import { toIsoString } from "../time.js";

function absoluteUrl(value, base) {
  if (!value) {
    return "";
  }

  if (parseHttpUrl(value)) {
    return normalizeUrl(value);
  }

  try {
    return normalizeUrl(new URL(value, `${base}/`).href);
  } catch {
    return "";
  }
}

export async function fetchItems(subscription, context) {
  const base = subscription.instanceUrl;
  if (!parseHttpUrl(base)) {
    throw new Error("This PeerTube subscription has no valid instance URL.");
  }

  const endpoint = `${base.replace(/\/$/, "")}/api/v1/video-channels/${encodeURIComponent(
    subscription.channelId
  )}/videos?sort=-publishedAt&count=${context.itemsPerSource}`;

  const payload = await context.fetchJson(endpoint, {
    timeoutMs: context.timeoutMs,
    accept: "application/json",
  });

  const videos = Array.isArray(payload?.data) ? payload.data : [];
  return videos
    .map((video) => {
      const uuid = String(video.uuid || video.id || "");
      const title = String(video.name || video.title || "")
        .trim()
        .slice(0, 500);
      const url = absoluteUrl(video.url, base) || `${base.replace(/\/$/, "")}/w/${uuid}`;
      const thumbnailUrl = absoluteUrl(
        video.thumbnailPath || video.thumbnailUrl || video.previewPath,
        base
      );
      const channelName =
        video.channel?.displayName || subscription.channelName || subscription.channelId;

      if (!uuid || !title || !parseHttpUrl(url)) {
        return null;
      }

      return {
        id: `peertube:${uuid}`,
        platform: subscription.platform,
        channelId: subscription.channelId,
        channelName,
        title,
        url,
        thumbnailUrl,
        publishedAt: toIsoString(video.publishedAt || video.createdAt),
      };
    })
    .filter((item) => item !== null)
    .slice(0, context.itemsPerSource);
}
