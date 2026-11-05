import { normalizeUrl, parseHttpUrl } from "../url.js";
import { toIsoString } from "../time.js";

export async function fetchItems(subscription, context) {
  const base = subscription.instanceUrl || "https://rutube.ru";
  const endpoint = `${base.replace(/\/$/, "")}/api/video/person/${encodeURIComponent(
    subscription.channelId
  )}/?sort=publication_d&show_hidden_videos=False&limit=${context.itemsPerSource}`;

  const payload = await context.fetchJson(endpoint, {
    timeoutMs: context.timeoutMs,
    accept: "application/json",
  });

  const videos = Array.isArray(payload?.results) ? payload.results : [];
  return videos
    .map((video) => {
      const id = String(video.id || "");
      const title = String(video.title || "")
        .trim()
        .slice(0, 500);
      const url = normalizeUrl(video.video_url);
      const thumbnailUrl = normalizeUrl(video.thumbnail_url);
      const timestamp = video.created_ts || video.publication_ts || video.date_ts || "";

      if (!id || !title || !parseHttpUrl(url)) {
        return null;
      }

      return {
        id: `rutube:${id}`,
        platform: subscription.platform,
        channelId: subscription.channelId,
        channelName: video.author?.name || subscription.channelName || subscription.channelId,
        title,
        url,
        thumbnailUrl,
        publishedAt: toIsoString(timestamp),
      };
    })
    .filter((item) => item !== null)
    .slice(0, context.itemsPerSource);
}
