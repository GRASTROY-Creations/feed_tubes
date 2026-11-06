import { createFeedAdapter } from "./generic-rss.js";

export const DAILYMOTION_ORIGIN = "https://www.dailymotion.com";

export const dailymotionAdapter = createFeedAdapter(
  (subscription) =>
    subscription.feedUrl ||
    `${DAILYMOTION_ORIGIN}/rss/user/${encodeURIComponent(subscription.channelId)}`
);
