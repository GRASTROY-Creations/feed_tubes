import { getPlatform } from "./platforms/registry.js";
import type { Subscription } from "./types.js";
import { originPattern } from "./url.js";

/** Host match pattern a subscription needs before its feed can be fetched. */
export function originForSubscription(subscription: Subscription): string {
  const { permissionOrigin } = getPlatform(subscription.platform);
  if (permissionOrigin) {
    return permissionOrigin;
  }

  const url =
    subscription.platform === "peertube"
      ? subscription.instanceUrl
      : subscription.feedUrl || subscription.instanceUrl;

  return originPattern(url);
}

function unique(origins: readonly string[]): string[] {
  return [...new Set(origins.filter(Boolean))];
}

export function originsForSubscriptions(subscriptions: readonly Subscription[]): string[] {
  return unique(subscriptions.map(originForSubscription));
}

export async function hasPermissionForSubscription(subscription: Subscription): Promise<boolean> {
  const origin = originForSubscription(subscription);
  return origin ? browser.permissions.contains({ origins: [origin] }) : false;
}

/** Prompts for the given origins; resolves `true` when nothing needs to be requested. */
export async function requestOrigins(origins: readonly string[]): Promise<boolean> {
  const uniqueOrigins = unique(origins);
  if (uniqueOrigins.length === 0) {
    return true;
  }
  return browser.permissions.request({ origins: uniqueOrigins });
}
