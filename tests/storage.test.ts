import { describe, expect, it } from "bun:test";
import {
  DEFAULT_SETTINGS,
  FEED_ITEMS_PER_SOURCE,
  normalizeState,
  SCHEMA_VERSION,
} from "../src/lib/storage.js";
import { feedItem } from "./fixtures.js";

describe("feed entry limit", () => {
  it("keeps six entries by default", () => {
    expect(DEFAULT_SETTINGS.feed.itemsPerSource).toBe(6);
  });

  it("forces six entries on settings from older installs", () => {
    const state = normalizeState({
      schemaVersion: SCHEMA_VERSION,
      settings: { feed: { itemsPerSource: 20, concurrency: 2 } },
    });
    expect(state.settings.feed.itemsPerSource).toBe(FEED_ITEMS_PER_SOURCE);
    expect(state.settings.feed.concurrency).toBe(2);
  });

  it("trims stored cache entries to six items", () => {
    const key = "youtube|UC123";
    const items = Array.from({ length: 10 }, (_, index) =>
      feedItem({ id: `item-${index}`, publishedAt: new Date(2026, 0, 10 - index).toISOString() })
    );
    const state = normalizeState({
      schemaVersion: SCHEMA_VERSION,
      cache: {
        [key]: {
          fetchedAt: "2026-11-20T10:00:00.000Z",
          items,
          error: { id: "error-raw", args: { detail: "bad" } },
          errorCode: "fetch-failed",
          failures: 2,
        },
      },
    });

    const entry = state.cache[key];
    expect(entry?.items).toHaveLength(FEED_ITEMS_PER_SOURCE);
    expect(entry?.items.map((item) => item.id)).toEqual(
      items.slice(0, FEED_ITEMS_PER_SOURCE).map((item) => item.id)
    );
    expect(entry?.error).toEqual({ id: "error-raw", args: { detail: "bad" } });
    expect(entry?.errorCode).toBe("fetch-failed");
    expect(entry?.failures).toBe(2);
  });
});
