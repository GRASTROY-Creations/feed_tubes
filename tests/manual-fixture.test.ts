import { describe, expect, it } from "bun:test";
import { parseSubscriptionsFile } from "../src/lib/import-export.js";
import { PLATFORM_IDS } from "../src/lib/platforms/registry.js";

const FILE = new URL("./manual/feedtubes-all-platforms.json", import.meta.url);

describe("manual test import file", () => {
  it("imports one valid subscription for every platform", async () => {
    const result = parseSubscriptionsFile(
      await Bun.file(FILE).text(),
      "feedtubes-all-platforms.json"
    );

    expect(result.format).toBe("unified-json");
    expect(result.invalid).toEqual([]);
    expect(result.subscriptions.map((subscription) => subscription.platform).sort()).toEqual(
      [...PLATFORM_IDS].sort()
    );
  });
});
