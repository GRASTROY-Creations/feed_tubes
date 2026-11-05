import { fetchItems as fetchRssItems } from "./generic-rss.js";

export function feedUrlFor(subscription) {
  if (subscription.feedUrl) {
    return subscription.feedUrl;
  }

  return `https://www.dailymotion.com/rss/user/${encodeURIComponent(subscription.channelId)}`;
}

export async function fetchItems(subscription, context) {
  const feedUrl = feedUrlFor(subscription);
  return fetchRssItems({ ...subscription, feedUrl }, context);
}
