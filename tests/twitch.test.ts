import { describe, expect, it } from "bun:test";
import { HttpError } from "../src/lib/errors.js";
import { originForSubscription } from "../src/lib/permissions.js";
import { twitchAdapter, twitchThumbnail } from "../src/lib/platforms/twitch.js";
import { normalizeSubscription } from "../src/lib/subscriptions.js";
import { parseTwitchRedirect, twitchAuthorizeUrl } from "../src/lib/twitch-auth.js";
import type { AdapterContext, FetchOptions } from "../src/lib/types.js";
import { apiKeys, at, rejectionOf, subscriptionOf } from "./fixtures.js";

const SIGNED_IN = apiKeys({
  twitchClientId: "client-123",
  twitchToken: "token-abc",
  twitchLogin: "me",
});

interface Call {
  url: string;
  options: FetchOptions | undefined;
}

/** Answers like Helix: one user, two videos, and optionally a live stream. */
function fakeHelix(live: boolean, calls: Call[] = []): AdapterContext {
  return {
    fetchJson: (url, options) => {
      calls.push({ url, options });
      if (url.includes("/users?")) {
        return Promise.resolve({
          data: [{ id: "12826", login: "twitch", display_name: "Twitch" }],
        });
      }
      if (url.includes("/streams?")) {
        return Promise.resolve({
          data: live
            ? [
                {
                  id: "41375541868",
                  user_name: "Twitch",
                  game_name: "Just Chatting",
                  title: "Live now",
                  started_at: "2026-11-10T10:00:00Z",
                  thumbnail_url:
                    "https://static-cdn.jtvnw.net/previews-ttv/live_user_twitch-{width}x{height}.jpg",
                },
              ]
            : [],
        });
      }
      return Promise.resolve({
        data: [
          {
            id: "335921245",
            user_name: "Twitch",
            title: "Past broadcast",
            created_at: "2026-11-09T18:00:00Z",
            published_at: "2026-11-09T18:00:00Z",
            url: "https://www.twitch.tv/videos/335921245",
            thumbnail_url:
              "https://static-cdn.jtvnw.net/cf_vods/d2nvs31859zcd8/thumb0-%{width}x%{height}.jpg",
          },
          {
            id: "335921246",
            title: "Still processing",
            created_at: "2026-11-10T09:00:00Z",
            url: "https://www.twitch.tv/videos/335921246",
            thumbnail_url:
              "https://vod-secure.twitch.tv/_404/404_processing_%{width}x%{height}.png",
          },
        ],
      });
    },
    fetchText: () => Promise.reject(new Error("unused")),
    postJson: () => Promise.reject(new Error("unused")),
    timeoutMs: 1000,
    itemsPerSource: 5,
    apiKeys: SIGNED_IN,
  };
}

const twitch = subscriptionOf({ platform: "twitch", channelId: "Twitch" });

describe("Twitch subscriptions", () => {
  it("accepts a name, @name, or channel URL and stores the lowercase login", () => {
    for (const input of ["Twitch", "@twitch", "https://www.twitch.tv/Twitch/videos"]) {
      const subscription = subscriptionOf({ platform: "twitch", channelId: input });
      expect(subscription.channelId).toBe("twitch");
      expect(subscription.channelUrl).toBe("https://www.twitch.tv/twitch");
    }
  });

  it("rejects twitch.tv pages that are not channels", () => {
    const result = normalizeSubscription({
      platform: "twitch",
      channelUrl: "https://www.twitch.tv/videos/335921245",
    });
    expect(result.errors).toContain("A channel ID or channel URL is required.");
  });

  it("needs the Helix host, or the bridge host when a feed URL is set", () => {
    expect(originForSubscription(twitch)).toBe("https://api.twitch.tv/*");
    const bridged = subscriptionOf({
      platform: "twitch",
      channelId: "twitch",
      feedUrl: "https://rsshub.example/twitch/video/twitch",
    });
    expect(originForSubscription(bridged)).toBe("https://rsshub.example/*");
  });
});

describe("twitchAdapter (Helix)", () => {
  it("lists videos newest first behind a LIVE card, with auth headers", async () => {
    const calls: Call[] = [];
    const items = await twitchAdapter.fetchItems(twitch, fakeHelix(true, calls));

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.twitch.tv/helix/users?login=twitch",
      "https://api.twitch.tv/helix/videos?user_id=12826&first=5&sort=time",
      "https://api.twitch.tv/helix/streams?user_login=twitch",
    ]);
    expect(at(calls, 0).options?.headers).toEqual({
      "Client-Id": "client-123",
      Authorization: "Bearer token-abc",
    });

    expect(items.map((item) => item.title)).toEqual([
      "Live now",
      "Past broadcast",
      "Still processing",
    ]);
    expect(at(items, 0)).toMatchObject({
      stream: "live",
      game: "Just Chatting",
      url: "https://www.twitch.tv/twitch",
      thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_twitch-320x180.jpg",
    });
    expect(at(items, 1).thumbnailUrl).toBe(
      "https://static-cdn.jtvnw.net/cf_vods/d2nvs31859zcd8/thumb0-320x180.jpg"
    );
    expect(at(items, 2).thumbnailUrl).toBe("");
  });

  it("asks to sign in when there is no token", async () => {
    const context = { ...fakeHelix(false), apiKeys: apiKeys({ twitchClientId: "client-123" }) };
    const error = await rejectionOf(twitchAdapter.fetchItems(twitch, context));
    expect(error.message).toContain("Sign in with Twitch in Settings → Instances");
  });

  it("explains an expired sign-in", async () => {
    const context: AdapterContext = {
      ...fakeHelix(false),
      fetchJson: () => Promise.reject(new HttpError(401, "https://api.twitch.tv/helix/users")),
    };
    const error = await rejectionOf(twitchAdapter.fetchItems(twitch, context));
    expect(error.message).toBe(
      "Your Twitch sign-in has expired. Sign in again in Settings → Instances."
    );
  });

  it("reads an RSS bridge instead when the subscription has a feed URL", async () => {
    const requested: string[] = [];
    const context: AdapterContext = {
      ...fakeHelix(false),
      apiKeys: apiKeys(),
      fetchText: (url) => {
        requested.push(url);
        return Promise.reject(new Error("bridge reached"));
      },
    };
    const bridged = subscriptionOf({
      platform: "twitch",
      channelId: "twitch",
      feedUrl: "https://rsshub.example/twitch/video/twitch",
    });

    const error = await rejectionOf(twitchAdapter.fetchItems(bridged, context));
    expect(error.message).toBe("bridge reached");
    expect(requested).toEqual(["https://rsshub.example/twitch/video/twitch"]);
  });
});

describe("Twitch thumbnails", () => {
  it("fills both template styles and drops processing placeholders", () => {
    expect(twitchThumbnail("https://x/thumb-%{width}x%{height}.jpg")).toBe(
      "https://x/thumb-320x180.jpg"
    );
    expect(twitchThumbnail("https://x/live-{width}x{height}.jpg")).toBe(
      "https://x/live-320x180.jpg"
    );
    expect(twitchThumbnail("https://x/_404/404_processing_%{width}x%{height}.png")).toBe("");
  });
});

describe("Sign in with Twitch", () => {
  it("builds an implicit-grant authorize URL without scopes", () => {
    const url = new URL(
      twitchAuthorizeUrl("client-123", "https://abc.extensions.allizom.org/", "state-1")
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "token",
      client_id: "client-123",
      redirect_uri: "https://abc.extensions.allizom.org/",
      scope: "",
      state: "state-1",
      force_verify: "true",
    });
  });

  it("reads the token from the redirect fragment", () => {
    expect(
      parseTwitchRedirect(
        "https://abc.extensions.allizom.org/#access_token=tok123&scope=&state=state-1&token_type=bearer",
        "state-1"
      )
    ).toBe("tok123");
  });

  it("rejects a redirect whose state does not match", () => {
    expect(() =>
      parseTwitchRedirect(
        "https://abc.extensions.allizom.org/#access_token=tok&state=other",
        "state-1"
      )
    ).toThrow("did not match the request");
  });

  it("reports errors Twitch sends back, such as a denied login", () => {
    expect(() =>
      parseTwitchRedirect(
        "https://abc.extensions.allizom.org/?error=access_denied&error_description=The+user+denied+you+access&state=state-1",
        "state-1"
      )
    ).toThrow("Twitch sign-in failed: The user denied you access");
  });
});
