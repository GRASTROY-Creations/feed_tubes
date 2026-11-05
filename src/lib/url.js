const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export function parseHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (!HTTP_PROTOCOLS.has(url.protocol)) {
    return null;
  }

  if (url.username || url.password) {
    return null;
  }

  return url;
}

export function isValidHttpUrl(value) {
  return parseHttpUrl(value) !== null;
}

export function normalizeUrl(value) {
  const url = parseHttpUrl(value);
  if (!url) {
    return "";
  }

  url.hash = "";
  return url.href.replace(/\/$/, "");
}

export function normalizeBaseUrl(value) {
  const url = parseHttpUrl(value);
  if (!url) {
    return "";
  }

  url.hash = "";
  url.search = "";
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
}

export function originPattern(value) {
  const url = parseHttpUrl(value);
  if (!url) {
    return "";
  }

  return `${url.protocol}//${url.hostname}/*`;
}

export function hostKey(value) {
  const url = parseHttpUrl(value);
  return url ? url.hostname.toLowerCase() : "";
}

export function isYouTubeChannelId(value) {
  return /^UC[\w-]{22}$/.test(String(value || "").trim());
}

export function extractYouTubeChannelId(value) {
  const text = String(value || "").trim();

  if (isYouTubeChannelId(text)) {
    return text;
  }

  const channelMatch = /youtube\.com\/channel\/(UC[\w-]{22})/i.exec(text);
  if (channelMatch) {
    return channelMatch[1];
  }

  return "";
}

export function decodeHtmlEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'");
}
