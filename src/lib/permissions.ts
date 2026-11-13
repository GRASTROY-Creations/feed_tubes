import { getPlatform } from "./platforms/registry.js";
import type { Subscription } from "./types.js";
import { hostKey, originPattern } from "./url.js";

/** Host match pattern a subscription needs before its feed can be fetched. */
export function originForSubscription(subscription: Subscription): string {
  const { permissionOrigin, allowsFeedUrl } = getPlatform(subscription.platform);
  // A subscription that reads an RSS bridge instead of the platform API needs the bridge host.
  if (allowsFeedUrl && subscription.feedUrl) {
    return originPattern(subscription.feedUrl);
  }
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

/** Host name a subscription's requests go to (`www.youtube.com`), or `""` when unknown. */
export function hostForSubscription(subscription: Subscription): string {
  return hostKey(originForSubscription(subscription).replace(/\*$/, ""));
}

function hasOrigin(origin: string): Promise<boolean> {
  return origin ? browser.permissions.contains({ origins: [origin] }) : Promise.resolve(false);
}

export function hasPermissionForSubscription(subscription: Subscription): Promise<boolean> {
  return hasOrigin(originForSubscription(subscription));
}

/**
 * `hasPermissionForSubscription` that asks the browser once per origin. Meant for one refresh
 * run: with thousands of subscriptions on a handful of hosts, it saves thousands of calls.
 */
export function createPermissionCheck(): (subscription: Subscription) => Promise<boolean> {
  const byOrigin = new Map<string, Promise<boolean>>();
  return (subscription) => {
    const origin = originForSubscription(subscription);
    let granted = byOrigin.get(origin);
    if (!granted) {
      granted = hasOrigin(origin);
      byOrigin.set(origin, granted);
    }
    return granted;
  };
}

/** Origins the given subscriptions need that have not been granted yet. */
export async function missingOrigins(subscriptions: readonly Subscription[]): Promise<string[]> {
  const origins = originsForSubscriptions(subscriptions);
  const granted = await Promise.all(origins.map(hasOrigin));
  return origins.filter((_, index) => !granted[index]);
}

/** Prompts for the given origins; resolves `true` when nothing needs to be requested. */
export async function requestOrigins(origins: readonly string[]): Promise<boolean> {
  const uniqueOrigins = unique(origins);
  if (uniqueOrigins.length === 0) {
    return true;
  }
  return browser.permissions.request({ origins: uniqueOrigins });
}
