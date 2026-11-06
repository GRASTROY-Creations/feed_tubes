import { HttpError, NetworkError } from "./errors.js";
import type { FetchOptions } from "./types.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;
const RETRY_DELAY_MS = 500;
const DEFAULT_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const RETRYABLE_STATUSES = new Set([408, 425, 429]);

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

/** Retries transient HTTP failures and network errors, never a request the caller aborted. */
function shouldRetry(error: unknown, callerSignal: AbortSignal | undefined): boolean {
  if (callerSignal?.aborted) {
    return false;
  }
  if (error instanceof HttpError) {
    return isRetryableStatus(error.status);
  }
  // fetch() rejects with a TypeError for network failures.
  return error instanceof TypeError;
}

async function attempt(
  url: string,
  responseType: ResponseType,
  init: RequestInitParts,
  { timeoutMs, signal, accept }: Required<Pick<FetchOptions, "timeoutMs" | "accept">> & FetchOptions
): Promise<unknown> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const headers: Record<string, string> = { Accept: accept };
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
    throw new HttpError(response.status, url);
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
  } = options;

  for (let attemptIndex = 0; ; attemptIndex += 1) {
    try {
      return await attempt(url, responseType, init, { timeoutMs, accept, signal });
    } catch (error) {
      if (attemptIndex >= retries || !shouldRetry(error, signal)) {
        // Name the URL, because the browser's own network error message does not.
        throw error instanceof TypeError ? new NetworkError(url, error) : error;
      }
      await wait(RETRY_DELAY_MS);
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
