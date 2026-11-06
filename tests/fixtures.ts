import { normalizeSubscription } from "../src/lib/subscriptions.js";
import type { FeedItem, RawSubscription, Subscription } from "../src/lib/types.js";

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
