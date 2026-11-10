/** Query parameters that carry credentials and must never appear in messages or storage. */
const SECRET_PARAMS = ["key", "api_key", "apikey", "access_token", "token"];

/** Returns `url` with credential query values replaced by `***`, for messages and logs. */
export function redactUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  let changed = false;
  for (const name of SECRET_PARAMS) {
    if (parsed.searchParams.has(name)) {
      parsed.searchParams.set(name, "***");
      changed = true;
    }
  }
  return changed ? parsed.href.replaceAll("%2A%2A%2A", "***") : url;
}

export class HttpError extends Error {
  readonly status: number;
  /** The requested URL with credentials redacted. */
  readonly url: string;

  constructor(status: number, url: string) {
    const safeUrl = redactUrl(url);
    super(`Request failed with HTTP ${status} (${safeUrl}).`);
    this.name = "HttpError";
    this.status = status;
    this.url = safeUrl;
  }
}

/** A request that never got a response: offline, DNS, TLS, CORS, or a blocked redirect. */
export class NetworkError extends Error {
  /** The requested URL with credentials redacted. */
  readonly url: string;

  constructor(url: string, cause: unknown) {
    const safeUrl = redactUrl(url);
    super(`Could not reach ${safeUrl}: ${errorMessage(cause, "network error")}`, { cause });
    this.name = "NetworkError";
    this.url = safeUrl;
  }
}

/** Extracts a user-facing message from any thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
