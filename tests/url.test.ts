import { describe, expect, it } from "bun:test";
import {
  extractYouTubeChannelId,
  isYouTubeChannelId,
  youtubeChannelOrHandleUrl,
  youtubeFeedUrl,
} from "../src/lib/platforms/youtube-urls.js";
import {
  hostKey,
  normalizeBaseUrl,
  normalizeUrl,
  originOf,
  originPattern,
  parseHttpUrl,
  resolveUrl,
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
    expect(parseHttpUrl(42)).toBeNull();
  });
});

describe("URL normalization", () => {
  it("removes hashes and trailing slashes", () => {
    expect(normalizeUrl("https://example.com/feed/#top/")).toBe("https://example.com/feed");
  });

  it("normalizes base URLs without query or hash", () => {
    expect(normalizeBaseUrl("https://example.com/path/?a=1#top")).toBe("https://example.com/path");
  });

  it("builds origins, origin patterns, and host keys", () => {
    expect(originOf("https://video.example:8443/path")).toBe("https://video.example:8443");
    expect(originPattern("https://video.example/path")).toBe("https://video.example/*");
    expect(hostKey("https://Video.Example/path")).toBe("video.example");
  });

  it("resolves relative URLs against a base", () => {
    expect(resolveUrl("/w/abc", "https://video.example/")).toBe("https://video.example/w/abc");
    expect(resolveUrl("", "https://video.example/")).toBe("");
  });
});

describe("YouTube URLs", () => {
  it("recognizes UC IDs and extracts them from URLs", () => {
    expect(isYouTubeChannelId("UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe(true);
    expect(isYouTubeChannelId("not-an-id")).toBe(false);
    expect(
      extractYouTubeChannelId("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/videos")
    ).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
  });

  it("builds channel, handle, and feed URLs", () => {
    expect(youtubeChannelOrHandleUrl("@example")).toBe("https://www.youtube.com/@example");
    expect(youtubeChannelOrHandleUrl("UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe(
      "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"
    );
    expect(youtubeFeedUrl("UC_x5XG1OV2P6uZZ5FSM9Ttw")).toBe(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw"
    );
  });
});
