import { originPattern } from "./url.js";
import { getPlatform } from "./platforms/registry.js";

export function originForSubscription(subscription) {
  const platform = getPlatform(subscription.platform);
  if (platform.permissionOrigin) {
    return platform.permissionOrigin;
  }

  const url =
    subscription.platform === "peertube"
      ? subscription.instanceUrl
      : subscription.feedUrl || subscription.instanceUrl;

  return originPattern(url);
}

export function originsForSubscriptions(subscriptions) {
  return [...new Set(subscriptions.map(originForSubscription).filter(Boolean))];
}

export async function hasPermission(origin) {
  if (!origin) {
    return false;
  }
  return browser.permissions.contains({ origins: [origin] });
}

export async function hasPermissionForSubscription(subscription) {
  return hasPermission(originForSubscription(subscription));
}

export async function requestOrigins(origins) {
  const uniqueOrigins = [...new Set(origins.filter(Boolean))];
  if (uniqueOrigins.length === 0) {
    return true;
  }
  return browser.permissions.request({ origins: uniqueOrigins });
}

export async function requestPermissionForSubscription(subscription) {
  return requestOrigins([originForSubscription(subscription)]);
}
