const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/** Parses an http(s) URL without embedded credentials, or returns `null`. */
export function parseHttpUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (!HTTP_PROTOCOLS.has(url.protocol) || url.username || url.password) {
    return null;
  }

  return url;
}

export function isValidHttpUrl(value: unknown): boolean {
  return parseHttpUrl(value) !== null;
}

/** Drops the hash and a trailing slash; returns `""` for invalid input. */
export function normalizeUrl(value: unknown): string {
  const url = parseHttpUrl(value);
  if (!url) {
    return "";
  }

  url.hash = "";
  return stripTrailingSlash(url.href);
}

/** Keeps only protocol, host, and path (without trailing slash). */
export function normalizeBaseUrl(value: unknown): string {
  const url = parseHttpUrl(value);
  if (!url) {
    return "";
  }

  return `${url.protocol}//${url.host}${stripTrailingSlash(url.pathname)}`;
}

/** `https://host:8080/path` → `https://host:8080`; returns `""` for invalid input. */
export function originOf(value: unknown): string {
  const url = parseHttpUrl(value);
  return url ? `${url.protocol}//${url.host}` : "";
}

/** Match pattern for `browser.permissions`, e.g. `https://host/*`. */
export function originPattern(value: unknown): string {
  const url = parseHttpUrl(value);
  return url ? `${url.protocol}//${url.hostname}/*` : "";
}

export function hostKey(value: unknown): string {
  return parseHttpUrl(value)?.hostname.toLowerCase() ?? "";
}

export function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

/** Resolves `value` against `base` and normalizes it; returns `""` on failure. */
export function resolveUrl(value: string, base: string): string {
  if (!value) {
    return "";
  }

  try {
    return normalizeUrl(new URL(value, base).href);
  } catch {
    return "";
  }
}
