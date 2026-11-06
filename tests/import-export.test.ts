import { describe, expect, it } from "bun:test";
import {
  detectFormat,
  exportSubscriptions,
  parseSubscriptionsFile,
} from "../src/lib/import-export.js";
import { at, subscriptionOf } from "./fixtures.js";

describe("format detection", () => {
  it("detects unified CSV", () => {
    expect(
      detectFormat(
        "platform,instance_url,channel_id,channel_name,channel_url,feed_url,enabled\nyoutube,https://www.youtube.com,UC_x5XG1OV2P6uZZ5FSM9Ttw,Example,,,true\n"
      )
    ).toBe("unified-csv");
  });

  it("detects YouTube/FreeTube CSV headers", () => {
    expect(
      detectFormat(
        'Channel Id,Channel Url,Channel Title\nUC_x5XG1OV2P6uZZ5FSM9Ttw,https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw,"A, B"\n'
      )
    ).toBe("youtube-csv");
  });

  it("detects unified JSON, NewPipe JSON, FreeTube .db, and OPML", () => {
    expect(
      detectFormat(
        JSON.stringify({
          format: "feedtubes.subscriptions",
          subscriptions: [{ platform: "youtube", channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw" }],
        })
      )
    ).toBe("unified-json");

    expect(
      detectFormat(
        JSON.stringify({
          subscriptions: [
            { service_id: 0, url: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw" },
          ],
        })
      )
    ).toBe("newpipe-json");

    expect(
      detectFormat(
        JSON.stringify({
          subscriptions: [{ id: "UC_x5XG1OV2P6uZZ5FSM9Ttw", name: "Example" }],
        })
      )
    ).toBe("freetube-db");

    expect(detectFormat('<opml version="2.0"><body></body></opml>')).toBe("opml");
  });
});

describe("parseSubscriptionsFile", () => {
  it("parses a YouTube CSV with quoted commas", () => {
    const result = parseSubscriptionsFile(
      'Channel Id,Channel Url,Channel Title\nUC_x5XG1OV2P6uZZ5FSM9Ttw,https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw,"A, B"\n'
    );

    expect(result.format).toBe("youtube-csv");
    expect(result.subscriptions).toHaveLength(1);
    expect(at(result.subscriptions, 0).channelName).toBe("A, B");
    expect(result.invalid).toHaveLength(0);
  });

  it("parses unified JSON", () => {
    const result = parseSubscriptionsFile(
      JSON.stringify({
        format: "feedtubes.subscriptions",
        subscriptions: [
          {
            platform: "youtube",
            channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
            channelName: "Example",
            enabled: false,
          },
        ],
      })
    );

    expect(at(result.subscriptions, 0).enabled).toBe(false);
    expect(at(result.subscriptions, 0).channelName).toBe("Example");
  });

  it("parses NewPipe JSON and skips non-YouTube services", () => {
    const result = parseSubscriptionsFile(
      JSON.stringify({
        subscriptions: [
          {
            service_id: 0,
            url: "https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
            name: "YouTube",
          },
          { service_id: 1, url: "https://peertube.example/c/science", name: "PeerTube" },
        ],
      })
    );

    expect(result.subscriptions).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });

  it("parses FreeTube .db newline-delimited JSON", () => {
    const profile = {
      _id: "allChannels",
      name: "All Channels",
      subscriptions: [{ id: "UC_x5XG1OV2P6uZZ5FSM9Ttw", name: "Example" }],
    };

    const result = parseSubscriptionsFile(`${JSON.stringify(profile)}\n`, "subscriptions.db");

    expect(result.format).toBe("freetube-db");
    expect(result.subscriptions).toHaveLength(1);
    expect(at(result.subscriptions, 0).channelId).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
  });

  it("rejects invalid JSON and unknown formats", () => {
    expect(() => parseSubscriptionsFile("{not json")).toThrow(
      "Unrecognized subscription file format."
    );
    expect(() => parseSubscriptionsFile("hello,world")).toThrow(
      "Unrecognized subscription file format."
    );
  });
});

describe("exportSubscriptions", () => {
  const subscriptions = [
    subscriptionOf({
      platform: "youtube",
      channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      channelName: "A, B",
    }),
    subscriptionOf({
      platform: "generic",
      feedUrl: "https://example.com/feed.xml",
      channelName: "Feed",
    }),
  ];

  it("round-trips the unified CSV", () => {
    const exported = exportSubscriptions("unified-csv", subscriptions);
    const parsed = parseSubscriptionsFile(exported.text);

    expect(parsed.format).toBe("unified-csv");
    expect(parsed.subscriptions).toHaveLength(2);
    expect(at(parsed.subscriptions, 0).channelName).toBe("A, B");
  });

  it("round-trips the unified JSON", () => {
    const exported = exportSubscriptions("unified-json", subscriptions, "enabled");
    const parsed = parseSubscriptionsFile(exported.text);

    expect(parsed.format).toBe("unified-json");
    expect(parsed.subscriptions).toHaveLength(2);
    expect(at(parsed.subscriptions, 1).feedUrl).toBe("https://example.com/feed.xml");
  });

  it("filters non-YouTube subscriptions from YouTube exports", () => {
    const csv = exportSubscriptions("youtube-csv", subscriptions);
    const parsed = parseSubscriptionsFile(csv.text);

    expect(parsed.subscriptions).toHaveLength(1);
    expect(at(parsed.subscriptions, 0).platform).toBe("youtube");

    const newpipe = JSON.parse(exportSubscriptions("newpipe-json", subscriptions).text) as {
      subscriptions: unknown[];
    };
    expect(newpipe.subscriptions).toHaveLength(1);

    const freetube = parseSubscriptionsFile(
      exportSubscriptions("freetube-db", subscriptions).text,
      "subscriptions.db"
    );
    expect(freetube.subscriptions).toHaveLength(1);
  });

  it("exports OPML outlines", () => {
    const output = exportSubscriptions("opml", subscriptions);
    expect(output.text).toContain("<opml");
    expect(output.text).toContain("https://www.youtube.com/feeds/videos.xml?channel_id=");
  });

  it("uses each platform's own feed URL in OPML exports", () => {
    const output = exportSubscriptions(
      "opml",
      [
        subscriptionOf({ platform: "odysee", channelId: "veritasium:f" }),
        subscriptionOf({ platform: "dailymotion", channelId: "arte" }),
      ],
      "all"
    );

    expect(output.text).toContain('xmlUrl="https://odysee.com/$/rss/@veritasium:f"');
    expect(output.text).toContain('xmlUrl="https://www.dailymotion.com/rss/user/arte"');
  });

  it("dates the filename from the given clock", () => {
    const output = exportSubscriptions(
      "unified-json",
      subscriptions,
      "all",
      new Date("2026-01-02T03:04:05Z")
    );

    expect(output.filename).toBe("feedtubes-subscriptions-2026-01-02.json");
    expect(output.text).toContain('"exportedAt": "2026-01-02T03:04:05.000Z"');
  });
});
