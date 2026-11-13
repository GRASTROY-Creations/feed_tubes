import { HttpError, NetworkError } from "./errors.js";
import type { FetchOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_JITTER_MS = 250;
const DEFAULT_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
/**
 * Transient statuses worth one more try. 429 is deliberately absent: a host that says
 * "too many requests" must not get more of them; the host throttle pauses it instead.
 */
const RETRYABLE_STATUSES = new Set([408, 425]);

type ResponseType = "text" | "json";

interface RequestInitParts {
  method: "GET" | "POST";
  body?: string;
  contentType?: string;
}

const GET: RequestInitParts = { method: "GET" };

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || status >= 500;
}

/** True for transient failures: server errors, timeouts, and network errors. */
export function isTransientError(error: unknown): boolean {
  if (error instanceof HttpError) {
    return isRetryableStatus(error.status);
  }
  // fetch() rejects with a TypeError for network failures; `request()` wraps it.
  return error instanceof TypeError || error instanceof NetworkError;
}

/** Retries transient failures, never a request the caller aborted. */
function shouldRetry(error: unknown, callerSignal: AbortSignal | undefined): boolean {
  return !callerSignal?.aborted && isTransientError(error);
}

/** Exponential backoff with jitter, so retries from many sources do not line up. */
export function retryDelayMs(attemptIndex: number, random: () => number = Math.random): number {
  return RETRY_BASE_DELAY_MS * 2 ** attemptIndex + Math.floor(random() * RETRY_JITTER_MS);
}

/**
 * `Retry-After` as milliseconds: either delay-seconds or an HTTP date. `null` when absent or
 * unreadable.
 */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

async function attempt(
  url: string,
  responseType: ResponseType,
  init: RequestInitParts,
  {
    timeoutMs,
    signal,
    accept,
    headers: extraHeaders,
  }: Required<Pick<FetchOptions, "timeoutMs" | "accept">> & FetchOptions
): Promise<unknown> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const headers: Record<string, string> = { ...extraHeaders, Accept: accept };
  if (init.contentType) {
    headers["Content-Type"] = init.contentType;
  }

  const response = await fetch(url, {
    method: init.method,
    body: init.body,
    credentials: "omit",
    redirect: "follow",
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    headers,
  });

  if (!response.ok) {
    throw new HttpError(response.status, url, parseRetryAfter(response.headers.get("Retry-After")));
  }

  return responseType === "json" ? response.json() : response.text();
}

async function request(
  url: string,
  responseType: ResponseType,
  init: RequestInitParts,
  options: FetchOptions = {}
): Promise<unknown> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    accept = DEFAULT_ACCEPT,
    signal,
    headers,
  } = options;

  for (let attemptIndex = 0; ; attemptIndex += 1) {
    try {
      return await attempt(url, responseType, init, { timeoutMs, accept, signal, headers });
    } catch (error) {
      if (attemptIndex >= retries || !shouldRetry(error, signal)) {
        // Name the URL, because the browser's own network error message does not.
        throw error instanceof TypeError ? new NetworkError(url, error) : error;
      }
      await wait(retryDelayMs(attemptIndex));
    }
  }
}

/** GET `url` as text with credentials omitted, a timeout, and limited retries. */
export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  return (await request(url, "text", GET, options)) as string;
}

/** GET `url` as parsed JSON. The result is untrusted and must be narrowed by the caller. */
export function fetchJson(url: string, options?: FetchOptions): Promise<unknown> {
  return request(url, "json", GET, options);
}

/** POST `body` as JSON to `url` and parse the JSON response (also untrusted). */
export function postJson(url: string, body: unknown, options?: FetchOptions): Promise<unknown> {
  return request(
    url,
    "json",
    { method: "POST", body: JSON.stringify(body), contentType: "application/json" },
    { accept: "application/json", ...options }
  );
}
