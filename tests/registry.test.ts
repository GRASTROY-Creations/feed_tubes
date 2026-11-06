import { describe, expect, it } from "bun:test";
import {
  compatibleInstanceKinds,
  getPlatform,
  isFeedOnlyPlatform,
  PLATFORM_IDS,
  PLATFORMS,
} from "../src/lib/platforms/registry.js";

describe("platform registry", () => {
  it("defines an adapter for every platform", () => {
    for (const id of PLATFORM_IDS) {
      expect(typeof PLATFORMS[id].adapter.fetchItems).toBe("function");
    }
  });

  it("requires a feed URL exactly for feed-only platforms", () => {
    for (const id of PLATFORM_IDS) {
      expect(PLATFORMS[id].requiresFeedUrl).toBe(isFeedOnlyPlatform(id));
    }
    expect(PLATFORM_IDS.filter(isFeedOnlyPlatform)).toEqual([
      "vkvideo",
      "bilibili",
      "rumble",
      "generic",
    ]);
  });

  it("falls back to the generic platform for unknown ids", () => {
    expect(getPlatform("myspace")).toBe(PLATFORMS.generic);
  });

  it("lets bridge subscriptions use RSSHub instances", () => {
    expect(compatibleInstanceKinds("vk")).toEqual(["vk", "rsshub"]);
    expect(compatibleInstanceKinds("peertube")).toEqual(["peertube"]);
  });
});
