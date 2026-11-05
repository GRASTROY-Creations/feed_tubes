import { describe, expect, it } from "bun:test";
import {
  extractYouTubeChannelId,
  hostKey,
  isYouTubeChannelId,
  normalizeBaseUrl,
  normalizeUrl,
  originPattern,
  parseHttpUrl,
} from "../src/lib/url.js";

describe("parseHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(parseHttpUrl("https://example.com/feed")?.hostname).toBe("example.com");
    expect(parseHttpUrl("http://localhost:8080/feed")?.port).toBe("8080");
  });

  it("rejects unsafe and credentialed URLs", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("data:text/plain,hello")).toBeNull();
    expect(parseHttpUrl("file:///etc/passwd")).toBeNull();
    expect(parseHttpUrl("https://user:pass@example.com/")).toBeNull();
    expect(parseHttpUrl("")).toBeNull();
  });
});

describe("URL normalization", () => {
  it("removes hashes and trailing slashes", () => {
    expect(normalizeUrl("https://example.com/feed/#top/")).toBe("https://example.com/feed");
  });

  it("normalizes base URLs without query or hash", () => {
    expect(normalizeBaseUrl("https://example.com/path/?a=1#top")).toBe("https://example.com/path");
  });

  it("builds origin patterns and host keys", () => {
    expect(originPattern("https://video.example/path")).toBe("https://video.example/*");
    expect(hostKey("https://Video.Example/path")).toBe("video.example");
  });
});

describe("YouTube channel IDs", () => {
  it("recognizes UC IDs and extracts them from URLs", () => {
    expect(isYouTubeChannelId("UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe(true);
    expect(isYouTubeChannelId("not-an-id")).toBe(false);
    expect(
      extractYouTubeChannelId("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/videos")
    ).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
  });
});
