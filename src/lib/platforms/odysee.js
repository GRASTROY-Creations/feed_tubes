import { fetchItems as fetchRssItems } from "./generic-rss.js";

export function feedUrlFor(subscription) {
  if (subscription.feedUrl) {
    return subscription.feedUrl;
  }

  const handle = String(subscription.channelId || "").replace(/^@?/, "@");
  return `https://odysee.com/$/rss/${handle}`;
}

export async function fetchItems(subscription, context) {
  const feedUrl = feedUrlFor(subscription);
  return fetchRssItems({ ...subscription, feedUrl }, context);
}
