import { defaultSettings } from "../src/lib/storage.js";
import { normalizeSubscription } from "../src/lib/subscriptions.js";
import type { ApiKeys, FeedItem, RawSubscription, Subscription } from "../src/lib/types.js";

/** API keys for adapter contexts: all empty unless overridden. */
export function apiKeys(overrides: Partial<ApiKeys> = {}): ApiKeys {
  return { ...defaultSettings().apiKeys, ...overrides };
}

/** Normalizes `raw` and fails the test if it is not a valid subscription. */
export function subscriptionOf(raw: RawSubscription): Subscription {
  const { subscription, errors } = normalizeSubscription(raw);
  if (!subscription) {
    throw new Error(`Invalid test subscription: ${errors.join(" ")}`);
  }
  return subscription;
}

export function feedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "item",
    platform: "generic",
    channelId: "",
    channelName: "",
    title: "Title",
    url: "https://example.com/item",
    thumbnailUrl: "",
    publishedAt: "",
    ...overrides,
  };
}

/** Resolves with the error `promise` rejects with; fails the test if it resolves. */
export async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }
    throw new Error("Expected the rejection to be an Error.", { cause: error });
  }
  throw new Error("Expected the promise to reject.");
}

/** Returns `values[index]`, failing the test when it is missing. */
export function at<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) {
    throw new Error(`Expected an element at index ${index}.`);
  }
  return value;
}
