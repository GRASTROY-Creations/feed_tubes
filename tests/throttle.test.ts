import { describe, expect, it } from "bun:test";
import { HostLimitError, HttpError } from "../src/lib/errors.js";
import {
  BREAKER_BASE_MS,
  BUDGET_WINDOW_MS,
  createHostThrottle,
  DEFAULT_HOST_POLICY,
  emptyHostLimits,
  normalizeHostLimits,
  type HostLimits,
  type ThrottleClock,
} from "../src/lib/throttle.js";
import type { FetchOptions } from "../src/lib/types.js";
import { rejectionOf } from "./fixtures.js";

const YOUTUBE = "www.youtube.com";
const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=x";

/** A clock that only moves when the throttle sleeps; random is fixed at 0 (no jitter). */
function fakeClock(start = 1_000_000): ThrottleClock & { time: () => number } {
  let now = start;
  let timers = Promise.resolve();
  return {
    now: () => now,
    sleep: (milliseconds) => {
      const target = now + Math.max(0, milliseconds);
      const timer = timers.then(() => {
        now = Math.max(now, target);
      });
      timers = timer;
      return timer;
    },
    random: () => 0,
    time: () => now,
  };
}

/** Wrapped fetchers whose `fetchText` records start times and answers with `respond`. */
function setup(
  respond: (call: number) => Promise<string> = () => Promise.resolve("ok"),
  limits: HostLimits = emptyHostLimits()
) {
  const clock = fakeClock();
  const throttle = createHostThrottle(limits, clock);
  const starts: number[] = [];
  const options: (FetchOptions | undefined)[] = [];
  const fetchers = throttle.wrap({
    fetchText: (_url, fetchOptions) => {
      starts.push(clock.time());
      options.push(fetchOptions);
      return respond(starts.length);
    },
    fetchJson: () => Promise.resolve({}),
    postJson: () => Promise.resolve({}),
  });
  return { clock, throttle, fetchers, starts, options };
}

describe("host throttle", () => {
  it("sends host requests one at a time, at least a second apart", async () => {
    const { fetchers, starts } = setup();
    await Promise.all([
      fetchers.fetchText(FEED),
      fetchers.fetchText(FEED),
      fetchers.fetchText(FEED),
    ]);

    expect(starts).toHaveLength(3);
    expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(1000);
    expect((starts[2] ?? 0) - (starts[1] ?? 0)).toBeGreaterThanOrEqual(1000);
  });

  it("pauses after every 50 requests", async () => {
    const { fetchers, starts } = setup();
    for (let index = 0; index < 51; index += 1) {
      await fetchers.fetchText(FEED);
    }
    const [minPause] = DEFAULT_HOST_POLICY.pauseMs;
    expect((starts[50] ?? 0) - (starts[49] ?? 0)).toBeGreaterThanOrEqual(1000 + minPause);
  });

  it("stops at the hourly budget without sending", async () => {
    const clock = fakeClock();
    const cap = DEFAULT_HOST_POLICY.hourlyCap;
    const oldest = clock.now() - 10 * 60 * 1000;
    const limits: HostLimits = {
      usage: { [YOUTUBE]: Array.from({ length: cap }, (_, index) => oldest + index) },
      paused: {},
      started: {},
      refusals: {},
    };
    const { fetchers, starts, throttle } = setup(undefined, limits);

    const error = await rejectionOf(fetchers.fetchText(FEED));
    expect(error).toBeInstanceOf(HostLimitError);
    expect(starts).toHaveLength(0);
    expect(throttle.blockedUntil(YOUTUBE)).toBe(oldest + BUDGET_WINDOW_MS);
  });

  it("pauses a host after three refusals in a row", async () => {
    const { fetchers, starts, throttle, clock } = setup(() =>
      Promise.reject(new HttpError(429, FEED))
    );
    for (let index = 0; index < 3; index += 1) {
      expect(await rejectionOf(fetchers.fetchText(FEED))).toBeInstanceOf(HttpError);
    }

    const blocked = await rejectionOf(fetchers.fetchText(FEED));
    expect(blocked).toBeInstanceOf(HostLimitError);
    expect(starts).toHaveLength(3);
    expect(throttle.blockedUntil(YOUTUBE)).toBeGreaterThanOrEqual(
      clock.now() + BREAKER_BASE_MS - 5000
    );
    expect(throttle.snapshot().paused[YOUTUBE]?.trips).toBe(1);
  });

  it("does not pause for other errors, and a success resets the count", async () => {
    const statuses = [403, 403, 404, 403, 403];
    const { fetchers, throttle } = setup((call) =>
      Promise.reject(new HttpError(statuses[call - 1] ?? 200, FEED))
    );
    // The throttle sends them one at a time, in order.
    await Promise.all(statuses.map(() => rejectionOf(fetchers.fetchText(FEED))));
    expect(throttle.blockedUntil(YOUTUBE)).toBeNull();
  });

  it("retries a transient failure once, through the gate, with fetch retries off", async () => {
    const { fetchers, starts, options } = setup((call) =>
      call === 1 ? Promise.reject(new HttpError(503, FEED)) : Promise.resolve("second")
    );
    expect(await fetchers.fetchText(FEED, { timeoutMs: 5 })).toBe("second");
    expect(starts).toHaveLength(2);
    expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(1000);
    expect(options.every((value) => value?.retries === 0 && value.timeoutMs === 5)).toBe(true);
  });

  it("does not retry a client error", async () => {
    const { fetchers, starts } = setup(() => Promise.reject(new HttpError(404, FEED)));
    await rejectionOf(fetchers.fetchText(FEED));
    expect(starts).toHaveLength(1);
  });

  it("spaces requests from one source even when they go to different hosts", async () => {
    const clock = fakeClock();
    const throttle = createHostThrottle(emptyHostLimits(), clock);
    const starts: Record<"a" | "b", number[]> = { a: [], b: [] };
    const wrapped = throttle.wrap({
      fetchText: (url) => {
        const host = url.includes("a.example") ? "a" : "b";
        starts[host].push(clock.time());
        return Promise.resolve("ok");
      },
      fetchJson: () => Promise.resolve({}),
      postJson: () => Promise.resolve({}),
    });

    await Promise.all([
      wrapped.fetchText("https://a.example/feed", { throttleKey: "source" }),
      wrapped.fetchText("https://b.example/feed", { throttleKey: "source" }),
    ]);
    expect(starts.a).toHaveLength(1);
    expect(starts.b).toHaveLength(1);
    expect(Math.abs((starts.b[0] ?? 0) - (starts.a[0] ?? 0))).toBeGreaterThanOrEqual(1000);
  });

  it("lets at most two requests start across hosts in a second", async () => {
    const clock = fakeClock();
    const throttle = createHostThrottle(emptyHostLimits(), clock);
    const starts: number[] = [];
    const wrapped = throttle.wrap({
      fetchText: () => {
        starts.push(clock.time());
        return Promise.resolve("ok");
      },
      fetchJson: () => Promise.resolve({}),
      postJson: () => Promise.resolve({}),
    });

    await Promise.all([
      wrapped.fetchText("https://a.example/feed"),
      wrapped.fetchText("https://b.example/feed"),
      wrapped.fetchText("https://c.example/feed"),
    ]);
    expect(starts).toHaveLength(3);
    expect((starts[2] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(1000);
  });

  it("keeps stored host counters until that host is used again", () => {
    const throttle = createHostThrottle({
      usage: {},
      paused: {},
      started: { a: 49 },
      refusals: { a: 2 },
    });
    expect(throttle.snapshot()).toEqual({
      usage: {},
      paused: {},
      started: { a: 49 },
      refusals: { a: 2 },
    });
  });

  it("counts usage per host and drops it after the window", () => {
    const clock = fakeClock();
    const throttle = createHostThrottle(
      {
        usage: { a: [clock.now() - BUDGET_WINDOW_MS - 1, clock.now() - 1] },
        paused: {},
        started: {},
        refusals: {},
      },
      clock
    );
    expect(throttle.snapshot().usage).toEqual({ a: [clock.now() - 1] });
  });
});

describe("normalizeHostLimits", () => {
  it("keeps valid entries and drops the rest", () => {
    expect(
      normalizeHostLimits({
        usage: { a: [1, "x", 2], b: "nope" },
        paused: { a: { until: 5, trips: 1 }, b: { until: "soon" } },
        started: { a: 7, b: -1, c: "many" },
        refusals: { a: 2, b: Infinity },
      })
    ).toEqual({
      usage: { a: [1, 2], b: [] },
      paused: { a: { until: 5, trips: 1 } },
      started: { a: 7 },
      refusals: { a: 2 },
    });
    expect(normalizeHostLimits(undefined)).toEqual(emptyHostLimits());
  });
});
