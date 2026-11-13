/**
 * Per-host request throttle. Every request a refresh makes goes through it, so no host ever
 * sees a burst: requests to one host are spaced out, capped per hour, and stopped entirely
 * once the host starts refusing them (HTTP 429/403).
 *
 * The limits are constants, not settings, so they cannot be raised by accident. They follow
 * what open-source YouTube clients do for large subscription lists (NewPipe pauses 6–12 s
 * after every 50 channels; PipePipe keeps a minimum gap per service).
 */
import { HostLimitError, HttpError } from "./errors.js";
import { asArray, asRecord } from "./guards.js";
import { isTransientError } from "./fetch.js";
import type { FetchJson, FetchOptions, FetchText, PostJson } from "./types.js";

export interface HostPolicy {
  /** Requests to the host that may be open at once. */
  maxInFlight: number;
  /** Minimum time between two request starts. */
  minGapMs: number;
  /** Random extra time added to each gap, so requests do not follow a fixed rhythm. */
  jitterMs: number;
  /** After this many requests, wait a random time from `pauseMs` (0 = never). */
  pauseEvery: number;
  pauseMs: readonly [min: number, max: number];
  /** Requests allowed per sliding hour. */
  hourlyCap: number;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export const DEFAULT_HOST_POLICY: Readonly<HostPolicy> = Object.freeze({
  maxInFlight: 2,
  minGapMs: 300,
  jitterMs: 0,
  pauseEvery: 0,
  pauseMs: [0, 0] as const,
  hourlyCap: 1500,
});

/** Hosts that need more care than the default. YouTube blocks IPs that look automated. */
export const HOST_POLICIES: Readonly<Record<string, Readonly<HostPolicy>>> = Object.freeze({
  "www.youtube.com": Object.freeze({
    maxInFlight: 1,
    minGapMs: SECOND_MS,
    jitterMs: 500,
    pauseEvery: 50,
    pauseMs: [8 * SECOND_MS, 15 * SECOND_MS] as const,
    hourlyCap: 900,
  }),
});

/** Refusals in a row that pause a host. */
export const BREAKER_THRESHOLD = 3;
export const BREAKER_BASE_MS = 30 * MINUTE_MS;
export const BREAKER_MAX_MS = 12 * HOUR_MS;
export const BUDGET_WINDOW_MS = HOUR_MS;

/** Statuses that mean "you are asking too much": they count towards pausing the host. */
const REFUSAL_STATUSES = new Set([403, 429]);

export function policyFor(host: string): Readonly<HostPolicy> {
  return HOST_POLICIES[host] ?? DEFAULT_HOST_POLICY;
}

/** Throttle state that outlives a refresh run; stored by the background script. */
export interface HostLimits {
  /** Start times (ms) of requests within the last `BUDGET_WINDOW_MS`, per host. */
  usage: Record<string, number[]>;
  /** Paused hosts: until when (ms), and how often in a row they were paused. */
  paused: Record<string, { until: number; trips: number }>;
}

export function emptyHostLimits(): HostLimits {
  return { usage: {}, paused: {} };
}

export interface ThrottleClock {
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  random: () => number;
}

const realClock: ThrottleClock = {
  now: () => Date.now(),
  sleep: (milliseconds) =>
    milliseconds > 0
      ? new Promise((resolve) => setTimeout(resolve, milliseconds))
      : Promise.resolve(),
  random: () => Math.random(),
};

interface HostGate {
  inFlight: number;
  waiting: (() => void)[];
  /** Earliest start time for the next request. */
  nextStartAt: number;
  started: number;
  refusalsInRow: number;
}

export interface ThrottledFetchers {
  fetchText: FetchText;
  fetchJson: FetchJson;
  postJson: PostJson;
}

export interface HostThrottle {
  /** Wraps fetch functions so every request goes through the throttle. */
  wrap(fetchers: ThrottledFetchers): ThrottledFetchers;
  /** When `host` may be asked again (ms), or `null` when it is available now. */
  blockedUntil(host: string): number | null;
  /** Copy of the state to store, with usage older than the budget window dropped. */
  snapshot(): HostLimits;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function randomBetween(clock: ThrottleClock, min: number, max: number): number {
  return min + Math.floor(clock.random() * (max - min));
}

export function createHostThrottle(
  initial: HostLimits = emptyHostLimits(),
  clock: ThrottleClock = realClock
): HostThrottle {
  const usage = new Map(Object.entries(initial.usage).map(([host, times]) => [host, [...times]]));
  const paused = new Map(
    Object.entries(initial.paused).map(([host, value]) => [host, { ...value }])
  );
  const gates = new Map<string, HostGate>();

  function gateFor(host: string): HostGate {
    let gate = gates.get(host);
    if (!gate) {
      gate = { inFlight: 0, waiting: [], nextStartAt: 0, started: 0, refusalsInRow: 0 };
      gates.set(host, gate);
    }
    return gate;
  }

  function recentUsage(host: string, now: number): number[] {
    const recent = (usage.get(host) ?? []).filter((time) => now - time < BUDGET_WINDOW_MS);
    usage.set(host, recent);
    return recent;
  }

  function limitFor(host: string, now: number): HostLimitError | null {
    const pause = paused.get(host);
    if (pause && pause.until > now) {
      return new HostLimitError("paused", host, pause.until);
    }
    const recent = recentUsage(host, now);
    if (recent.length >= policyFor(host).hourlyCap) {
      return new HostLimitError("budget", host, (recent[0] ?? now) + BUDGET_WINDOW_MS);
    }
    return null;
  }

  async function acquire(host: string, gate: HostGate): Promise<void> {
    const policy = policyFor(host);
    while (gate.inFlight >= policy.maxInFlight) {
      await new Promise<void>((resolve) => gate.waiting.push(resolve));
    }
    gate.inFlight += 1;

    // Reserve a start time, then wait for it. Reserving first keeps the spacing correct
    // when several requests queue up at once.
    const now = clock.now();
    const startAt = Math.max(now, gate.nextStartAt);
    gate.started += 1;
    const pause =
      policy.pauseEvery > 0 && gate.started % policy.pauseEvery === 0
        ? randomBetween(clock, policy.pauseMs[0], policy.pauseMs[1])
        : 0;
    gate.nextStartAt = startAt + policy.minGapMs + randomBetween(clock, 0, policy.jitterMs) + pause;
    await clock.sleep(startAt - now);
  }

  function release(gate: HostGate): void {
    gate.inFlight -= 1;
    gate.waiting.shift()?.();
  }

  function recordOutcome(host: string, gate: HostGate, error: unknown): void {
    if (!(error instanceof HttpError && REFUSAL_STATUSES.has(error.status))) {
      gate.refusalsInRow = 0;
      if (error === undefined) {
        // A success after an expired pause: the host is fine again.
        paused.delete(host);
      }
      return;
    }

    gate.refusalsInRow += 1;
    if (gate.refusalsInRow < BREAKER_THRESHOLD) {
      return;
    }
    gate.refusalsInRow = 0;
    const trips = (paused.get(host)?.trips ?? 0) + 1;
    const backoff = Math.min(BREAKER_BASE_MS * 2 ** (trips - 1), BREAKER_MAX_MS);
    const until = clock.now() + Math.max(backoff, error.retryAfterMs ?? 0);
    paused.set(host, { until, trips });
  }

  /** One request through the gate: waits its turn, checks the limits, records the outcome. */
  async function once<T>(host: string, send: () => Promise<T>): Promise<T> {
    const gate = gateFor(host);
    await acquire(host, gate);
    try {
      // Checked after waiting: the host may have been paused while this request queued.
      const limit = limitFor(host, clock.now());
      if (limit) {
        throw limit;
      }
      recentUsage(host, clock.now()).push(clock.now());
      try {
        const result = await send();
        recordOutcome(host, gate, undefined);
        return result;
      } catch (error) {
        recordOutcome(host, gate, error);
        throw error;
      }
    } finally {
      release(gate);
    }
  }

  /**
   * Sends with `retries: 0` and retries a transient failure once itself, through the gate,
   * so the retry is spaced and counted like any other request.
   */
  async function run<T>(url: string, send: () => Promise<T>): Promise<T> {
    const host = hostOf(url);
    if (!host) {
      return send();
    }
    try {
      return await once(host, send);
    } catch (error) {
      if (!isTransientError(error)) {
        throw error;
      }
      return once(host, send);
    }
  }

  const noRetry = (options?: FetchOptions): FetchOptions => ({ ...options, retries: 0 });

  return {
    wrap(fetchers) {
      return {
        fetchText: (url, options) => run(url, () => fetchers.fetchText(url, noRetry(options))),
        fetchJson: (url, options) => run(url, () => fetchers.fetchJson(url, noRetry(options))),
        postJson: (url, body, options) =>
          run(url, () => fetchers.postJson(url, body, noRetry(options))),
      };
    },

    blockedUntil(host) {
      return limitFor(host, clock.now())?.until ?? null;
    },

    snapshot() {
      const now = clock.now();
      const usageEntries = [...usage.keys()]
        .map((host) => [host, recentUsage(host, now)] as const)
        .filter(([, times]) => times.length > 0);
      // Keep expired pauses: their trip count makes the next pause longer if the host
      // refuses again right away. A success clears them.
      return {
        usage: Object.fromEntries(usageEntries),
        paused: Object.fromEntries([...paused].map(([host, value]) => [host, { ...value }])),
      };
    },
  };
}

/** Narrows stored data to `HostLimits`, dropping anything malformed. */
export function normalizeHostLimits(value: unknown): HostLimits {
  const stored = asRecord(value);
  const limits = emptyHostLimits();

  for (const [host, times] of Object.entries(asRecord(stored.usage))) {
    limits.usage[host] = asArray(times).filter(
      (time): time is number => typeof time === "number" && Number.isFinite(time)
    );
  }
  for (const [host, entry] of Object.entries(asRecord(stored.paused))) {
    const { until, trips } = asRecord(entry);
    if (typeof until === "number" && typeof trips === "number") {
      limits.paused[host] = { until, trips };
    }
  }
  return limits;
}
