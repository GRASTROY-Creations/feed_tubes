import { normalizeHeader, parseCsv, rowsToObjects, serializeCsv } from "./csv.js";
import { asArray, asRecord, asString, isRecord, type UnknownRecord } from "./guards.js";
import { getPlatform } from "./platforms/registry.js";
import {
  extractYouTubeChannelId,
  isYouTubeChannelId,
  youtubeChannelUrl,
} from "./platforms/youtube-urls.js";
import { normalizeSubscription } from "./subscriptions.js";
import type { RawSubscription, Subscription } from "./types.js";
import { hostKey, normalizeUrl } from "./url.js";
import { parseXml } from "./xml.js";

export type ImportFormat =
  | "unified-json"
  | "youtube-json"
  | "newpipe-json"
  | "freetube-db"
  | "unified-csv"
  | "youtube-csv"
  | "opml";

export type DetectedFormat = ImportFormat | "empty" | "xml" | "invalid-json" | "unknown";

export type ExportFormat =
  "unified-csv" | "unified-json" | "youtube-csv" | "newpipe-json" | "freetube-db" | "opml";

export type ExportScope = "all" | "enabled";

export const EXPORT_FORMATS: readonly { id: ExportFormat; label: string }[] = [
  { id: "unified-csv", label: "FeedTubes CSV" },
  { id: "unified-json", label: "FeedTubes JSON" },
  { id: "youtube-csv", label: "YouTube / FreeTube CSV" },
  { id: "newpipe-json", label: "NewPipe JSON" },
  { id: "freetube-db", label: "FreeTube .db" },
  { id: "opml", label: "OPML" },
];

export function isExportFormat(value: unknown): value is ExportFormat {
  return EXPORT_FORMATS.some((format) => format.id === value);
}

const UNIFIED_FORMAT_ID = "feedtubes.subscriptions";

export interface InvalidRow {
  /** 1-based position in the source file. */
  index: number;
  errors: string[];
}

export interface ParsedSubscriptions {
  subscriptions: Subscription[];
  invalid: InvalidRow[];
  warnings: string[];
}

export interface ImportResult extends ParsedSubscriptions {
  format: ImportFormat;
}

export interface ExportFile {
  filename: string;
  text: string;
  mime: string;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

/** A FreeTube profile (`{_id, subscriptions: [{id, name}]}`) or a legacy channel record. */
function isFreeTubeProfile(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  if (value._id || value.channelId) {
    return true;
  }

  return asArray(value.subscriptions).some(
    (subscription) =>
      isRecord(subscription) &&
      subscription.id !== undefined &&
      subscription.platform === undefined &&
      subscription.service_id === undefined &&
      subscription.snippet === undefined
  );
}

/** FreeTube `.db` files are newline-delimited JSON. */
function isFreeTubeDb(text: string): boolean {
  const lines = nonEmptyLines(text);
  if (lines.length === 0 || !lines.every((line) => line.startsWith("{"))) {
    return false;
  }

  return lines.some((line) => {
    const parsed = tryParseJson(line);
    return parsed.ok && isFreeTubeProfile(parsed.value);
  });
}

const YOUTUBE_CSV_HEADERS = new Set(["channelid", "channelurl", "channeltitle", "channelname"]);

function detectCsvFormat(text: string): ImportFormat | null {
  const headers = (parseCsv(text)[0] ?? []).map(normalizeHeader);

  if (headers.includes("platform")) {
    return "unified-csv";
  }
  if (headers.some((header) => YOUTUBE_CSV_HEADERS.has(header))) {
    return "youtube-csv";
  }
  return null;
}

function detectJsonFormat(data: unknown): ImportFormat {
  if (Array.isArray(data)) {
    return "youtube-json";
  }

  const record = asRecord(data);
  if (record.format === UNIFIED_FORMAT_ID) {
    return "unified-json";
  }

  const subscriptions = asArray(record.subscriptions).map(asRecord);
  if (subscriptions.some((item) => item.service_id !== undefined)) {
    return "newpipe-json";
  }
  if (subscriptions.some((item) => item.platform)) {
    return "unified-json";
  }
  if (subscriptions.some((item) => item.snippet)) {
    return "youtube-json";
  }
  if (Array.isArray(record.subscriptions) && isFreeTubeProfile(record)) {
    return "freetube-db";
  }
  return "unified-json";
}

export function detectFormat(text: string, filename = ""): DetectedFormat {
  const trimmed = text.trim();
  if (!trimmed) {
    return "empty";
  }

  if (filename.toLowerCase().endsWith(".db")) {
    return "freetube-db";
  }

  if (trimmed.startsWith("<")) {
    return /<opml[\s>]/i.test(trimmed) ? "opml" : "xml";
  }

  if (/^[{[]/.test(trimmed)) {
    const parsed = tryParseJson(trimmed);
    return parsed.ok ? detectJsonFormat(parsed.value) : "invalid-json";
  }

  if (isFreeTubeDb(trimmed)) {
    return "freetube-db";
  }

  return detectCsvFormat(trimmed) ?? "unknown";
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function normalizeMany(
  rawSubscriptions: readonly RawSubscription[],
  warnings: string[] = []
): ParsedSubscriptions {
  const subscriptions: Subscription[] = [];
  const invalid: InvalidRow[] = [];

  rawSubscriptions.forEach((raw, index) => {
    const result = normalizeSubscription(raw);
    if (result.subscription) {
      subscriptions.push(result.subscription);
    } else {
      invalid.push({ index: index + 1, errors: result.errors });
    }
  });

  return { subscriptions, invalid, warnings };
}

function youtubeRaw(
  channelId: string,
  channelUrl: string,
  channelName: string
): RawSubscription | null {
  const url = channelUrl || (channelId ? youtubeChannelUrl(channelId) : "");
  if (!channelId && !url) {
    return null;
  }
  return { platform: "youtube", channelId, channelUrl: url, channelName };
}

function isRaw(value: RawSubscription | null): value is RawSubscription {
  return value !== null;
}

function parseUnifiedJson(text: string): ParsedSubscriptions {
  const data = JSON.parse(text) as unknown;
  const values: unknown = Array.isArray(data) ? data : asRecord(data).subscriptions;
  if (!Array.isArray(values)) {
    throw new Error("This JSON file does not contain a subscriptions array.");
  }
  return normalizeMany(values.map(asRecord));
}

/** YouTube Data API / Takeout JSON: `[{snippet: {resourceId: {channelId}, title}}]`. */
function parseYouTubeJson(text: string): ParsedSubscriptions {
  const data = JSON.parse(text) as unknown;
  const values: unknown = Array.isArray(data) ? data : asRecord(data).items;
  if (!Array.isArray(values)) {
    throw new Error("This JSON file does not contain YouTube subscriptions.");
  }

  const raws = values.map((value) => {
    const item = asRecord(value);
    const snippet: UnknownRecord = isRecord(item.snippet) ? item.snippet : item;
    const snippetUrl = asString(snippet.channelUrl) || asString(snippet.url);
    const channelId =
      asString(asRecord(snippet.resourceId).channelId) ||
      asString(snippet.channelId) ||
      asString(item.channelId) ||
      extractYouTubeChannelId(snippetUrl) ||
      (isYouTubeChannelId(item.id) ? item.id : "");
    const channelName =
      asString(snippet.title) || asString(snippet.channelName) || asString(item.name);
    return youtubeRaw(channelId, snippetUrl, channelName);
  });

  return normalizeMany(raws.filter(isRaw));
}

/** NewPipe backup: `{subscriptions: [{service_id, url, name}]}`; service 0 is YouTube. */
function parseNewPipeJson(text: string): ParsedSubscriptions {
  const warnings: string[] = [];
  const raws: RawSubscription[] = [];

  for (const value of asArray(asRecord(JSON.parse(text)).subscriptions)) {
    const item = asRecord(value);
    if (Number(item.service_id ?? 0) !== 0) {
      warnings.push("Skipped a non-YouTube NewPipe subscription.");
      continue;
    }

    const channelUrl = asString(item.url);
    const raw = youtubeRaw(extractYouTubeChannelId(channelUrl), channelUrl, asString(item.name));
    if (raw) {
      raws.push(raw);
    }
  }

  return normalizeMany(raws, warnings);
}

function freeTubeProfileSubscriptions(profile: UnknownRecord): RawSubscription[] {
  if (Array.isArray(profile.subscriptions)) {
    return asArray(profile.subscriptions)
      .map((value) => {
        const subscription = asRecord(value);
        const url = asString(subscription.url);
        const channelId =
          asString(subscription.id) ||
          extractYouTubeChannelId(url) ||
          asString(subscription.channelId);
        const channelName = asString(subscription.name) || asString(subscription.channelName);
        return youtubeRaw(channelId, url, channelName);
      })
      .filter(isRaw);
  }

  const channelId = asString(profile.channelId);
  return channelId
    ? [
        {
          platform: "youtube",
          channelId,
          channelUrl: asString(profile.channelUrl),
          channelName: asString(profile.channelName),
        },
      ]
    : [];
}

function parseFreeTubeDb(text: string): ParsedSubscriptions {
  const warnings: string[] = [];
  const raws: RawSubscription[] = [];

  for (const line of nonEmptyLines(text)) {
    const parsed = tryParseJson(line);
    if (!parsed.ok) {
      warnings.push("Skipped a FreeTube line that is not valid JSON.");
      continue;
    }
    raws.push(...freeTubeProfileSubscriptions(asRecord(parsed.value)));
  }

  return normalizeMany(raws, warnings);
}

/** YouTube Takeout / FreeTube CSV: `Channel Id, Channel Url, Channel Title`, header optional. */
function parseYouTubeCsv(text: string): ParsedSubscriptions {
  const rows = parseCsv(text);
  const [first] = rows;
  if (!first) {
    throw new Error("The CSV file is empty.");
  }

  const hasHeader = !isYouTubeChannelId(first[0] ?? "") && !normalizeUrl(first[1]);
  const raws = rows.slice(hasHeader ? 1 : 0).map((row) => ({
    platform: "youtube",
    channelId: (row[0] ?? "").trim(),
    channelUrl: (row[1] ?? "").trim(),
    channelName: row
      .slice(2)
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", "),
  }));

  return normalizeMany(raws);
}

function parseUnifiedCsv(text: string): ParsedSubscriptions {
  return normalizeMany(rowsToObjects(parseCsv(text)).objects);
}

function parseOpml(text: string): ParsedSubscriptions {
  if (typeof DOMParser === "undefined") {
    throw new Error("OPML import is not available in this environment.");
  }

  const document = parseXml(text, "The OPML file is not valid XML.");
  const raws: RawSubscription[] = [];

  for (const outline of Array.from(document.getElementsByTagName("outline"))) {
    const feedUrl = normalizeUrl(outline.getAttribute("xmlUrl"));
    if (!feedUrl) {
      continue;
    }

    const htmlUrl = normalizeUrl(outline.getAttribute("htmlUrl"));
    const title = outline.getAttribute("title") || outline.getAttribute("text") || "";
    const channelId = extractYouTubeChannelId(feedUrl) || extractYouTubeChannelId(htmlUrl);

    raws.push(
      channelId
        ? {
            platform: "youtube",
            channelId,
            channelUrl: htmlUrl || youtubeChannelUrl(channelId),
            channelName: title,
          }
        : {
            platform: "generic",
            feedUrl,
            channelUrl: htmlUrl || feedUrl,
            channelName: title || hostKey(feedUrl),
          }
    );
  }

  return normalizeMany(raws);
}

const PARSERS: Record<ImportFormat, (text: string) => ParsedSubscriptions> = {
  "unified-json": parseUnifiedJson,
  "youtube-json": parseYouTubeJson,
  "newpipe-json": parseNewPipeJson,
  "freetube-db": parseFreeTubeDb,
  "unified-csv": parseUnifiedCsv,
  "youtube-csv": parseYouTubeCsv,
  opml: parseOpml,
};

function isImportFormat(format: DetectedFormat): format is ImportFormat {
  return Object.hasOwn(PARSERS, format);
}

/** Detects the file format and parses it into normalized subscriptions. */
export function parseSubscriptionsFile(text: string, filename = ""): ImportResult {
  const format = detectFormat(text, filename);

  if (format === "empty") {
    throw new Error("The selected file is empty.");
  }
  if (!isImportFormat(format)) {
    throw new Error("Unrecognized subscription file format.");
  }

  return { format, ...PARSERS[format](text) };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const UNIFIED_CSV_HEADER = [
  "platform",
  "instance_url",
  "channel_id",
  "channel_name",
  "channel_url",
  "feed_url",
  "enabled",
];

/** Values NewPipe expects in an importable backup. */
const NEWPIPE_APP_VERSION = { app_version: "0.27.6", app_version_int: 1003 };

const FREETUBE_PROFILE = {
  _id: "allChannels",
  name: "All Channels",
  bgColor: "#BD93F9",
  textColor: "#000000",
};

function exportObject(subscription: Subscription): Subscription {
  return {
    platform: subscription.platform,
    instanceUrl: subscription.instanceUrl,
    channelId: subscription.channelId,
    channelName: subscription.channelName,
    channelUrl: subscription.channelUrl,
    feedUrl: subscription.feedUrl,
    enabled: subscription.enabled,
  };
}

function youtubeOnly(subscriptions: readonly Subscription[]): Subscription[] {
  return subscriptions.filter((subscription) => subscription.platform === "youtube");
}

function channelUrlOf(subscription: Subscription): string {
  return subscription.channelUrl || youtubeChannelUrl(subscription.channelId);
}

function feedUrlForExport(subscription: Subscription): string {
  return (
    getPlatform(subscription.platform).adapter.feedUrlFor?.(subscription) ||
    subscription.feedUrl ||
    subscription.channelUrl
  );
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function opmlOutline(subscription: Subscription): string {
  const feedUrl = feedUrlForExport(subscription);
  if (!feedUrl) {
    return "";
  }

  const name = xmlEscape(subscription.channelName);
  return `    <outline type="rss" text="${name}" title="${name}" xmlUrl="${xmlEscape(feedUrl)}" htmlUrl="${xmlEscape(subscription.channelUrl)}" />`;
}

function exportOpml(subscriptions: readonly Subscription[]): string {
  const outlines = subscriptions.map(opmlOutline).filter(Boolean).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>FeedTubes subscriptions</title>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;
}

type Exporter = (subscriptions: readonly Subscription[], now: Date) => ExportFile;

const CSV_MIME = "text/csv;charset=utf-8";
const JSON_MIME = "application/json";

function datestamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

const EXPORTERS: Record<ExportFormat, Exporter> = {
  "unified-csv": (subscriptions, now) => ({
    filename: `feedtubes-subscriptions-${datestamp(now)}.csv`,
    text: serializeCsv([
      UNIFIED_CSV_HEADER,
      ...subscriptions.map((subscription) => [
        subscription.platform,
        subscription.instanceUrl,
        subscription.channelId,
        subscription.channelName,
        subscription.channelUrl,
        subscription.feedUrl,
        String(subscription.enabled),
      ]),
    ]),
    mime: CSV_MIME,
  }),

  "unified-json": (subscriptions, now) => ({
    filename: `feedtubes-subscriptions-${datestamp(now)}.json`,
    text: JSON.stringify(
      {
        format: UNIFIED_FORMAT_ID,
        version: 1,
        exportedAt: now.toISOString(),
        subscriptions: subscriptions.map(exportObject),
      },
      null,
      2
    ),
    mime: JSON_MIME,
  }),

  "youtube-csv": (subscriptions, now) => ({
    filename: `youtube-subscriptions-${datestamp(now)}.csv`,
    text: serializeCsv([
      ["Channel Id", "Channel Url", "Channel Title"],
      ...youtubeOnly(subscriptions).map((subscription) => [
        subscription.channelId,
        channelUrlOf(subscription),
        subscription.channelName,
      ]),
    ]),
    mime: CSV_MIME,
  }),

  "newpipe-json": (subscriptions, now) => ({
    filename: `newpipe-subscriptions-${datestamp(now)}.json`,
    text: JSON.stringify(
      {
        ...NEWPIPE_APP_VERSION,
        subscriptions: youtubeOnly(subscriptions).map((subscription) => ({
          service_id: 0,
          url: channelUrlOf(subscription),
          name: subscription.channelName,
        })),
      },
      null,
      2
    ),
    mime: JSON_MIME,
  }),

  "freetube-db": (subscriptions, now) => ({
    filename: `freetube-subscriptions-${datestamp(now)}.db`,
    text: `${JSON.stringify({
      ...FREETUBE_PROFILE,
      subscriptions: youtubeOnly(subscriptions).map((subscription) => ({
        id: subscription.channelId,
        name: subscription.channelName,
        thumbnail: "",
      })),
    })}\n`,
    mime: "application/x-freetube-db",
  }),

  opml: (subscriptions, now) => ({
    filename: `feedtubes-subscriptions-${datestamp(now)}.opml`,
    text: exportOpml(subscriptions),
    mime: "text/x-opml;charset=utf-8",
  }),
};

export function exportSubscriptions(
  format: ExportFormat,
  subscriptions: readonly Subscription[],
  scope: ExportScope = "all",
  now = new Date()
): ExportFile {
  const selected =
    scope === "enabled"
      ? subscriptions.filter((subscription) => subscription.enabled)
      : subscriptions;
  return EXPORTERS[format](selected, now);
}
