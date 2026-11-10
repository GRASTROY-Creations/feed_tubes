import { translate, type LocalizedText, type MessageKey } from "./i18n/index.js";

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

/**
 * An error whose message is a translation. It keeps the message id and arguments, so the error
 * can be stored or sent to another extension context as `LocalizedText` and translated again
 * when shown, in whatever language is active then. `message` is the text at creation time,
 * for logs and `errorMessage()`.
 */
export class LocalizedError extends Error {
  readonly text: LocalizedText;

  constructor(id: MessageKey, args?: LocalizedText["args"], options?: ErrorOptions) {
    const text: LocalizedText = args ? { id, args } : { id };
    super(translate(text), options);
    this.name = "LocalizedError";
    this.text = text;
  }
}

export class HttpError extends LocalizedError {
  readonly status: number;
  /** The requested URL with credentials redacted. */
  readonly url: string;

  constructor(status: number, url: string) {
    const safeUrl = redactUrl(url);
    // The status is a code, not a quantity, so it is passed as text and never digit-grouped.
    super("fetch-http-error", { status: String(status), url: safeUrl });
    this.name = "HttpError";
    this.status = status;
    this.url = safeUrl;
  }
}

/** A request that never got a response: offline, DNS, TLS, CORS, or a blocked redirect. */
export class NetworkError extends LocalizedError {
  /** The requested URL with credentials redacted. */
  readonly url: string;

  constructor(url: string, cause: unknown) {
    const safeUrl = redactUrl(url);
    super(
      "fetch-network-error",
      { url: safeUrl, cause: toLocalizedText(cause, "fetch-network-fallback") },
      { cause }
    );
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

/**
 * Any thrown value as storable `LocalizedText`. Errors from FeedTubes keep their message id;
 * other errors (from the browser or a library) keep their own text, unchanged, as data.
 */
export function toLocalizedText(error: unknown, fallback: MessageKey): LocalizedText {
  if (error instanceof LocalizedError) {
    return error.text;
  }
  if (error instanceof Error && error.message) {
    return { id: "error-raw", args: { detail: error.message } };
  }
  return { id: fallback };
}

/** `toLocalizedText`, translated now: for errors shown right away rather than stored. */
export function localizedErrorMessage(error: unknown, fallback: MessageKey): string {
  return translate(toLocalizedText(error, fallback));
}
