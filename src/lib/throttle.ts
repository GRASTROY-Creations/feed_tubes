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
  /** Requests to the host that may start in a sliding second. */
  maxPerSecond: number;
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

/**
 * One conservative policy for every host. YouTube used to have a special entry, but a client
 * that looks automated should be equally gentle everywhere; the shared limits also make the
 * per-second and per-source caps below easy to reason about.
 */
export const DEFAULT_HOST_POLICY: Readonly<HostPolicy> = Object.freeze({
  maxInFlight: 1,
  maxPerSecond: 1,
  minGapMs: SECOND_MS,
  jitterMs: 150,
  pauseEvery: 50,
  pauseMs: [8 * SECOND_MS, 15 * SECOND_MS] as const,
  hourlyCap: 900,
});

/** Aggregate limits: a second host may run alongside the first, but never more. */
export const GLOBAL_MAX_PER_SECOND = 2;
export const GLOBAL_MAX_IN_FLIGHT = 2;

/** A subscription's adapter already fetches sequentially; the gate also spaces those starts. */
export const SOURCE_MAX_PER_SECOND = 1;
export const SOURCE_MAX_IN_FLIGHT = 1;

/** Refusals in a row that pause a host. */
export const BREAKER_THRESHOLD = 3;
export const BREAKER_BASE_MS = 30 * MINUTE_MS;
export const BREAKER_MAX_MS = 12 * HOUR_MS;
export const BUDGET_WINDOW_MS = HOUR_MS;

/** Statuses that mean "you are asking too much": they count towards pausing the host. */
const REFUSAL_STATUSES = new Set([403, 429]);

/** Throttle state that outlives a refresh run; stored by the background script. */
export interface HostLimits {
  /** Start times (ms) of requests within the last `BUDGET_WINDOW_MS`, per host. */
  usage: Record<string, number[]>;
  /** Paused hosts: until when (ms), and how often in a row they were paused. */
  paused: Record<string, { until: number; trips: number }>;
  /** Requests started per host, kept so periodic pauses survive short background runs. */
  started: Record<string, number>;
  /** Refusals in a row per host, kept so the breaker survives short background runs. */
  refusals: Record<string, number>;
}

export function emptyHostLimits(): HostLimits {
  return { usage: {}, paused: {}, started: {}, refusals: {} };
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

interface RequestGate {
  inFlight: number;
  waiting: (() => void)[];
  /** Planned starts in the current sliding second, including ones still sleeping. */
  starts: number[];
  /** Earliest start time for the next request. */
  nextStartAt: number;
}

interface HostGate extends RequestGate {
  started: number;
  refusalsInRow: number;
}

interface Reservation {
  startAt: number;
  release: () => void;
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
  const globalGate: RequestGate = { inFlight: 0, waiting: [], starts: [], nextStartAt: 0 };
  const sourceGates = new Map<string, RequestGate>();

  function emptyGate(): RequestGate {
    return { inFlight: 0, waiting: [], starts: [], nextStartAt: 0 };
  }

  function gateFor(host: string): HostGate {
    let gate = gates.get(host);
    if (!gate) {
      gate = {
        ...emptyGate(),
        started: initial.started[host] ?? 0,
        refusalsInRow: initial.refusals[host] ?? 0,
      };
      gates.set(host, gate);
    }
    return gate;
  }

  function sourceGateFor(key: string): RequestGate {
    let gate = sourceGates.get(key);
    if (!gate) {
      gate = emptyGate();
      sourceGates.set(key, gate);
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
    if (recent.length >= DEFAULT_HOST_POLICY.hourlyCap) {
      return new HostLimitError("budget", host, (recent[0] ?? now) + BUDGET_WINDOW_MS);
    }
    return null;
  }

  /** Claims an in-flight slot atomically; the check and increment cannot interleave. */
  async function enterGate(gate: RequestGate, maxInFlight: number): Promise<void> {
    if (gate.inFlight < maxInFlight) {
      gate.inFlight += 1;
      return;
    }
    // The slot is handed over by releaseSlot, so it is already counted for us.
    await new Promise<void>((resolve) => gate.waiting.push(resolve));
  }

  function releaseSlot(gate: RequestGate): void {
    const next = gate.waiting.shift();
    if (next) {
      next();
    } else {
      gate.inFlight -= 1;
    }
  }

  /**
   * Reserves a planned start in the sliding second before sleeping. Recording the slot up
   * front stops queued requests from all seeing an empty window when they wake up together.
   */
  function reserveStart(gate: RequestGate, maxPerSecond: number): number {
    const now = clock.now();
    gate.starts = gate.starts.filter((time) => now - time < SECOND_MS);
    let startAt = Math.max(now, gate.nextStartAt);
    const oldest = gate.starts[0];
    if (gate.starts.length >= maxPerSecond && oldest !== undefined) {
      startAt = Math.max(startAt, oldest + SECOND_MS);
    }
    gate.starts.push(startAt);
    return startAt;
  }

  async function reserveGlobal(): Promise<Reservation> {
    await enterGate(globalGate, GLOBAL_MAX_IN_FLIGHT);
    const startAt = reserveStart(globalGate, GLOBAL_MAX_PER_SECOND);
    globalGate.nextStartAt = startAt + SECOND_MS / GLOBAL_MAX_PER_SECOND;
    return {
      startAt,
      release: () => {
        releaseSlot(globalGate);
      },
    };
  }

  async function reserveSource(key: string): Promise<Reservation> {
    const gate = sourceGateFor(key);
    await enterGate(gate, SOURCE_MAX_IN_FLIGHT);
    const startAt = reserveStart(gate, SOURCE_MAX_PER_SECOND);
    gate.nextStartAt = startAt + SECOND_MS / SOURCE_MAX_PER_SECOND;
    return {
      startAt,
      release: () => {
        releaseSlot(gate);
      },
    };
  }

  async function reserveHost(host: string): Promise<Reservation & { gate: HostGate }> {
    const gate = gateFor(host);
    const policy = DEFAULT_HOST_POLICY;
    await enterGate(gate, policy.maxInFlight);
    const startAt = reserveStart(gate, policy.maxPerSecond);
    gate.started += 1;
    const pause =
      policy.pauseEvery > 0 && gate.started % policy.pauseEvery === 0
        ? randomBetween(clock, policy.pauseMs[0], policy.pauseMs[1])
        : 0;
    gate.nextStartAt = startAt + policy.minGapMs + randomBetween(clock, 0, policy.jitterMs) + pause;
    return {
      startAt,
      release: () => {
        releaseSlot(gate);
      },
      gate,
    };
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

  /** One request through every gate: reserves all slots, waits once, then sends. */
  async function once<T>(
    host: string,
    sourceKey: string | undefined,
    send: () => Promise<T>
  ): Promise<T> {
    const global = await reserveGlobal();
    let source: Reservation | undefined;
    let hostReservation: (Reservation & { gate: HostGate }) | undefined;
    try {
      if (sourceKey) {
        source = await reserveSource(sourceKey);
      }
      try {
        hostReservation = await reserveHost(host);
        try {
          const startAt = Math.max(global.startAt, source?.startAt ?? 0, hostReservation.startAt);
          await clock.sleep(Math.max(0, startAt - clock.now()));
          // Checked after waiting: the host may have been paused while this request queued.
          const limit = limitFor(host, clock.now());
          if (limit) {
            throw limit;
          }
          recentUsage(host, clock.now()).push(clock.now());
          try {
            const result = await send();
            recordOutcome(host, hostReservation.gate, undefined);
            return result;
          } catch (error) {
            recordOutcome(host, hostReservation.gate, error);
            throw error;
          }
        } finally {
          hostReservation.release();
        }
      } finally {
        source?.release();
      }
    } finally {
      global.release();
    }
  }

  /**
   * Sends with `retries: 0` and retries a transient failure once itself, through the gates,
   * so the retry is spaced and counted like any other request.
   */
  async function run<T>(url: string, send: () => Promise<T>, sourceKey?: string): Promise<T> {
    const host = hostOf(url);
    if (!host) {
      return send();
    }
    try {
      return await once(host, sourceKey, send);
    } catch (error) {
      if (!isTransientError(error)) {
        throw error;
      }
      return once(host, sourceKey, send);
    }
  }

  /** Keeps the internal throttle key out of the options passed to the fetch implementation. */
  function noRetry(options?: FetchOptions): FetchOptions {
    const safe: FetchOptions = { ...options, retries: 0 };
    delete safe.throttleKey;
    return safe;
  }

  return {
    wrap(fetchers) {
      return {
        fetchText: (url, options) =>
          run(url, () => fetchers.fetchText(url, noRetry(options)), options?.throttleKey),
        fetchJson: (url, options) =>
          run(url, () => fetchers.fetchJson(url, noRetry(options)), options?.throttleKey),
        postJson: (url, body, options) =>
          run(url, () => fetchers.postJson(url, body, noRetry(options)), options?.throttleKey),
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
      const hosts = new Set([
        ...usage.keys(),
        ...gates.keys(),
        ...Object.keys(initial.started),
        ...Object.keys(initial.refusals),
      ]);
      return {
        usage: Object.fromEntries(usageEntries),
        paused: Object.fromEntries([...paused].map(([host, value]) => [host, { ...value }])),
        started: Object.fromEntries(
          [...hosts].map((host) => [host, gates.get(host)?.started ?? initial.started[host] ?? 0])
        ),
        refusals: Object.fromEntries(
          [...hosts].map((host) => [
            host,
            gates.get(host)?.refusalsInRow ?? initial.refusals[host] ?? 0,
          ])
        ),
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
  for (const [host, count] of Object.entries(asRecord(stored.started))) {
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
      limits.started[host] = count;
    }
  }
  for (const [host, count] of Object.entries(asRecord(stored.refusals))) {
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
      limits.refusals[host] = count;
    }
  }
  return limits;
}
