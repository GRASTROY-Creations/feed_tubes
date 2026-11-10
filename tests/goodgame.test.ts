import { describe, expect, it } from "bun:test";
import { HttpError } from "../src/lib/errors.js";
import { goodgameAdapter } from "../src/lib/platforms/goodgame.js";
import type { AdapterContext } from "../src/lib/types.js";
import { apiKeys, at, rejectionOf, subscriptionOf } from "./fixtures.js";

/** Trimmed shape of GET https://goodgame.ru/api/4/users/<channel>/stream. */
function stream(online: boolean): Record<string, unknown> {
  return {
    id: 5,
    title: "Пройдем ли Дредноут?..",
    link: "https://goodgame.ru/Miker",
    streamer: { id: 1, nickname: "Miker", username: "Miker" },
    game: "XCOM: Enemy Within",
    online,
    streamPreview: "https://hls.goodgame.ru/previews/5.jpg",
    poster: "/files/logotypes/ch_229673_LbfN.png",
    preview: "//hls.goodgame.ru/previews/5_240.jpg",
    last_online_int: 1794252848,
  };
}

function context(
  respond: (url: string) => Promise<unknown>,
  requested: string[] = []
): AdapterContext {
  return {
    fetchJson: (url) => {
      requested.push(url);
      return respond(url);
    },
    fetchText: () => Promise.reject(new Error("unused")),
    postJson: () => Promise.reject(new Error("unused")),
    timeoutMs: 1000,
    itemsPerSource: 5,
    apiKeys: apiKeys(),
  };
}

const miker = subscriptionOf({ platform: "goodgame", channelId: "Miker" });

describe("goodgame.ru subscriptions", () => {
  it("accepts a name or a channel URL, old or new style", () => {
    for (const input of [
      "Miker",
      "https://goodgame.ru/Miker",
      "https://goodgame.ru/channel/Miker/",
    ]) {
      const subscription = subscriptionOf({ platform: "goodgame", channelId: input });
      expect(subscription.channelId).toBe("Miker");
      expect(subscription.channelUrl).toBe("https://goodgame.ru/Miker");
    }
  });
});

describe("goodgameAdapter", () => {
  it("shows a live channel as one LIVE card with the stream preview", async () => {
    const requested: string[] = [];
    const items = await goodgameAdapter.fetchItems(
      miker,
      context(() => Promise.resolve(stream(true)), requested)
    );

    expect(requested).toEqual(["https://goodgame.ru/api/4/users/Miker/stream"]);
    expect(items).toHaveLength(1);
    expect(at(items, 0)).toMatchObject({
      id: "goodgame:miker",
      title: "LIVE: Пройдем ли Дредноут?.. (XCOM: Enemy Within)",
      url: "https://goodgame.ru/Miker",
      thumbnailUrl: "https://hls.goodgame.ru/previews/5.jpg",
      publishedAt: "2026-11-09T19:34:08.000Z",
      channelName: "Miker",
    });
  });

  it("shows an offline channel as its last stream, with the channel poster", async () => {
    const [item] = await goodgameAdapter.fetchItems(
      miker,
      context(() => Promise.resolve(stream(false)))
    );
    expect(item?.title).toBe("Last stream: Пройдем ли Дредноут?.. (XCOM: Enemy Within)");
    expect(item?.thumbnailUrl).toBe("https://goodgame.ru/files/logotypes/ch_229673_LbfN.png");
  });

  it("names unknown channels instead of showing an HTTP error", async () => {
    const error = await rejectionOf(
      goodgameAdapter.fetchItems(
        miker,
        context(() =>
          Promise.reject(new HttpError(404, "https://goodgame.ru/api/4/users/x/stream"))
        )
      )
    );
    expect(error.message).toBe('goodgame.ru has no channel named "Miker".');
  });
});
