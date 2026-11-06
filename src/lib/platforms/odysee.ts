import { createFeedAdapter } from "./generic-rss.js";

export const ODYSEE_ORIGIN = "https://odysee.com";

/** `name:claim` or `@name:claim` → `@name:claim` */
export function odyseeHandle(channelId: string): string {
  return channelId.replace(/^@?/, "@");
}

export const odyseeAdapter = createFeedAdapter(
  (subscription) =>
    subscription.feedUrl || `${ODYSEE_ORIGIN}/$/rss/${odyseeHandle(subscription.channelId)}`
);
