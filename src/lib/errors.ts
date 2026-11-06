export class HttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string) {
    super(`Request failed with HTTP ${status} (${url}).`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

/** A request that never got a response: offline, DNS, TLS, CORS, or a blocked redirect. */
export class NetworkError extends Error {
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`Could not reach ${url}: ${errorMessage(cause, "network error")}`, { cause });
    this.name = "NetworkError";
    this.url = url;
  }
}

/** Extracts a user-facing message from any thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
