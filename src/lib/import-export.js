import { parseCsv, rowsToObjects, serializeCsv } from "./csv.js";
import { normalizeSubscription } from "./subscriptions.js";
import {
  extractYouTubeChannelId,
  hostKey,
  isYouTubeChannelId,
  normalizeUrl,
  parseHttpUrl,
} from "./url.js";

export const IMPORT_ACCEPT = ".csv,.json,.db,.opml,.xml";

export const EXPORT_FORMATS = [
  { id: "unified-csv", label: "FeedTubes CSV", extension: "csv" },
  { id: "unified-json", label: "FeedTubes JSON", extension: "json" },
  { id: "youtube-csv", label: "YouTube / FreeTube CSV", extension: "csv" },
  { id: "newpipe-json", label: "NewPipe JSON", extension: "json" },
  { id: "freetube-db", label: "FreeTube .db", extension: "db" },
  { id: "opml", label: "OPML", extension: "opml" },
];

function looksLikeJson(text) {
  return /^[{[]/.test(text.trim());
}

function nonEmptyLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isFreeTubeProfile(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (value._id || value.channelId) {
    return true;
  }

  if (!Array.isArray(value.subscriptions)) {
    return false;
  }

  return value.subscriptions.some(
    (subscription) =>
      subscription &&
      subscription.id !== undefined &&
      subscription.platform === undefined &&
      subscription.service_id === undefined &&
      subscription.snippet === undefined
  );
}

function isFreeTubeDb(text) {
  const lines = nonEmptyLines(text);
  if (lines.length === 0 || !lines.every((line) => line.startsWith("{"))) {
    return false;
  }

  return lines.some((line) => {
    try {
      return isFreeTubeProfile(JSON.parse(line));
    } catch {
      return false;
    }
  });
}

function detectHeaderFormat(rows) {
  if (rows.length === 0) {
    return "";
  }

  const headers = rows[0].map((header) =>
    String(header || "")
      .trim()
      .toLowerCase()
      .replaceAll(/[\s_-]+/g, "")
  );

  if (headers.includes("platform")) {
    return "unified-csv";
  }

  if (
    headers.includes("channelid") ||
    headers.includes("channelurl") ||
    headers.includes("channeltitle") ||
    headers.includes("channelname")
  ) {
    return "youtube-csv";
  }

  return "";
}

function normalizeMany(rawSubscriptions) {
  const subscriptions = [];
  const invalid = [];

  rawSubscriptions.forEach((raw, index) => {
    const result = normalizeSubscription(raw);
    if (result.subscription) {
      subscriptions.push(result.subscription);
    } else {
      invalid.push({ index: index + 1, errors: result.errors });
    }
  });

  return { subscriptions, invalid };
}

function parseUnifiedJson(data) {
  const values = Array.isArray(data) ? data : data.subscriptions;
  if (!Array.isArray(values)) {
    throw new Error("This JSON file does not contain a subscriptions array.");
  }
  return normalizeMany(values);
}

function parseYouTubeJson(data) {
  const values = Array.isArray(data) ? data : data.items;
  if (!Array.isArray(values)) {
    throw new Error("This JSON file does not contain YouTube subscriptions.");
  }

  const rawSubscriptions = values
    .map((item) => {
      const snippet = item?.snippet || item;
      const channelId =
        snippet?.resourceId?.channelId ||
        snippet?.channelId ||
        item?.channelId ||
        extractYouTubeChannelId(snippet?.channelUrl || snippet?.url || "") ||
        (isYouTubeChannelId(item?.id) ? item.id : "");
      const channelUrl =
        snippet?.channelUrl ||
        snippet?.url ||
        (channelId ? `https://www.youtube.com/channel/${channelId}` : "");
      const channelName = snippet?.title || snippet?.channelName || item?.name || "";

      if (!channelId && !channelUrl) {
        return null;
      }

      return {
        platform: "youtube",
        channelId,
        channelUrl,
        channelName,
      };
    })
    .filter((item) => item !== null);

  return normalizeMany(rawSubscriptions);
}

function parseNewPipeJson(data) {
  const values = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  const warnings = [];
  const rawSubscriptions = [];

  for (const item of values) {
    const serviceId = Number(item?.service_id ?? 0);
    if (serviceId !== 0) {
      warnings.push("Skipped a non-YouTube NewPipe subscription.");
      continue;
    }

    const channelUrl = String(item?.url || "");
    const channelId = extractYouTubeChannelId(channelUrl);
    if (!channelId && !channelUrl) {
      continue;
    }

    rawSubscriptions.push({
      platform: "youtube",
      channelId,
      channelUrl,
      channelName: item?.name || "",
    });
  }

  return { ...normalizeMany(rawSubscriptions), warnings };
}

function parseFreeTubeDb(text) {
  const rawSubscriptions = [];
  const warnings = [];

  for (const line of nonEmptyLines(text)) {
    let profile;
    try {
      profile = JSON.parse(line);
    } catch {
      warnings.push("Skipped a FreeTube line that is not valid JSON.");
      continue;
    }

    if (Array.isArray(profile?.subscriptions)) {
      for (const subscription of profile.subscriptions) {
        const channelId =
          subscription?.id ||
          extractYouTubeChannelId(subscription?.url || "") ||
          subscription?.channelId ||
          "";
        const channelUrl =
          subscription?.url || (channelId ? `https://www.youtube.com/channel/${channelId}` : "");
        if (!channelId && !channelUrl) {
          continue;
        }
        rawSubscriptions.push({
          platform: "youtube",
          channelId,
          channelUrl,
          channelName: subscription?.name || subscription?.channelName || "",
        });
      }
    } else if (profile?.channelId) {
      rawSubscriptions.push({
        platform: "youtube",
        channelId: profile.channelId,
        channelUrl: profile.channelUrl || "",
        channelName: profile.channelName || "",
      });
    }
  }

  return { ...normalizeMany(rawSubscriptions), warnings };
}

function parseYouTubeCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error("The CSV file is empty.");
  }

  let startIndex = 0;
  const first = rows[0];
  if (!/^UC[\w-]{22}$/.test(String(first[0] || "").trim()) && !parseHttpUrl(first[1])) {
    startIndex = 1;
  }

  const rawSubscriptions = rows.slice(startIndex).map((row) => ({
    platform: "youtube",
    channelId: String(row[0] || "").trim(),
    channelUrl: String(row[1] || "").trim(),
    channelName: row
      .slice(2)
      .map((value) => value.trim())
      .filter(Boolean)
      .join(", "),
  }));

  return normalizeMany(rawSubscriptions);
}

function parseUnifiedCsv(text) {
  const rows = parseCsv(text);
  const { objects } = rowsToObjects(rows);
  return normalizeMany(objects);
}

function parseOpml(text) {
  if (typeof DOMParser === "undefined") {
    throw new Error("OPML import is not available in this environment.");
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("The OPML file is not valid XML.");
  }

  const outlines = Array.from(document.getElementsByTagName("outline"));
  const rawSubscriptions = [];

  for (const outline of outlines) {
    const feedUrl = normalizeUrl(outline.getAttribute("xmlUrl") || "");
    if (!feedUrl) {
      continue;
    }

    const htmlUrl = normalizeUrl(outline.getAttribute("htmlUrl") || "");
    const title = outline.getAttribute("title") || outline.getAttribute("text") || "";
    const channelId = extractYouTubeChannelId(feedUrl) || extractYouTubeChannelId(htmlUrl);

    if (channelId) {
      rawSubscriptions.push({
        platform: "youtube",
        channelId,
        channelUrl: htmlUrl || `https://www.youtube.com/channel/${channelId}`,
        channelName: title,
      });
    } else {
      rawSubscriptions.push({
        platform: "generic",
        feedUrl,
        channelUrl: htmlUrl || feedUrl,
        channelName: title || hostKey(feedUrl),
      });
    }
  }

  return normalizeMany(rawSubscriptions);
}

export function detectFormat(text, filename = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "empty";
  }

  if (filename.toLowerCase().endsWith(".db")) {
    return "freetube-db";
  }

  if (trimmed.startsWith("<")) {
    return /<opml[\s>]/i.test(trimmed) ? "opml" : "xml";
  }

  if (looksLikeJson(trimmed)) {
    try {
      const data = JSON.parse(trimmed);
      if (data?.format === "feedtubes.subscriptions") {
        return "unified-json";
      }
      if (Array.isArray(data)) {
        return data.some((item) => item?.snippet) ? "youtube-json" : "youtube-json";
      }
      if (Array.isArray(data?.subscriptions)) {
        if (data.subscriptions.some((item) => item?.service_id !== undefined)) {
          return "newpipe-json";
        }
        if (data.subscriptions.some((item) => item?.platform)) {
          return "unified-json";
        }
        if (data.subscriptions.some((item) => item?.snippet)) {
          return "youtube-json";
        }
        if (isFreeTubeProfile(data)) {
          return "freetube-db";
        }
      }
      return "unified-json";
    } catch {
      return "invalid-json";
    }
  }

  if (isFreeTubeDb(trimmed)) {
    return "freetube-db";
  }

  const csvFormat = detectHeaderFormat(parseCsv(trimmed));
  return csvFormat || "unknown";
}

export function parseSubscriptionsFile(text, filename = "") {
  const format = detectFormat(text, filename);

  switch (format) {
    case "unified-json":
      return { format, ...parseUnifiedJson(JSON.parse(text)) };
    case "youtube-json":
      return { format, ...parseYouTubeJson(JSON.parse(text)) };
    case "newpipe-json":
      return { format, ...parseNewPipeJson(JSON.parse(text)) };
    case "freetube-db":
      return { format, ...parseFreeTubeDb(text) };
    case "unified-csv":
      return { format, ...parseUnifiedCsv(text) };
    case "youtube-csv":
      return { format, ...parseYouTubeCsv(text) };
    case "opml":
      return { format, ...parseOpml(text) };
    case "empty":
      throw new Error("The selected file is empty.");
    default:
      throw new Error("Unrecognized subscription file format.");
  }
}

function exportObject(subscription) {
  return {
    platform: subscription.platform,
    instanceUrl: subscription.instanceUrl || "",
    channelId: subscription.channelId || "",
    channelName: subscription.channelName || "",
    channelUrl: subscription.channelUrl || "",
    feedUrl: subscription.feedUrl || "",
    enabled: Boolean(subscription.enabled),
  };
}

function youtubeSubscriptions(subscriptions) {
  return subscriptions.filter((subscription) => subscription.platform === "youtube");
}

function feedUrlForExport(subscription) {
  if (subscription.feedUrl) {
    return subscription.feedUrl;
  }
  if (subscription.platform === "youtube") {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
      subscription.channelId
    )}`;
  }
  if (subscription.platform === "odysee") {
    return `https://odysee.com/$/rss/${subscription.channelId}`;
  }
  if (subscription.platform === "dailymotion") {
    return `https://www.dailymotion.com/rss/user/${encodeURIComponent(subscription.channelId)}`;
  }
  return subscription.channelUrl || "";
}

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function exportOpml(subscriptions) {
  const outlines = subscriptions
    .map((subscription) => {
      const feedUrl = feedUrlForExport(subscription);
      if (!feedUrl) {
        return "";
      }
      return `    <outline type="rss" text="${xmlEscape(
        subscription.channelName
      )}" title="${xmlEscape(subscription.channelName)}" xmlUrl="${xmlEscape(
        feedUrl
      )}" htmlUrl="${xmlEscape(subscription.channelUrl)}" />`;
    })
    .filter(Boolean)
    .join("\n");

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

export function exportSubscriptions(format, subscriptions, scope = "all") {
  const selected =
    scope === "enabled"
      ? subscriptions.filter((subscription) => subscription.enabled)
      : subscriptions;
  const date = new Date().toISOString().slice(0, 10);

  switch (format) {
    case "unified-csv": {
      const rows = [
        [
          "platform",
          "instance_url",
          "channel_id",
          "channel_name",
          "channel_url",
          "feed_url",
          "enabled",
        ],
        ...selected.map((subscription) => {
          const value = exportObject(subscription);
          return [
            value.platform,
            value.instanceUrl,
            value.channelId,
            value.channelName,
            value.channelUrl,
            value.feedUrl,
            value.enabled ? "true" : "false",
          ];
        }),
      ];
      return {
        filename: `feedtubes-subscriptions-${date}.csv`,
        text: serializeCsv(rows),
        mime: "text/csv;charset=utf-8",
      };
    }
    case "unified-json":
      return {
        filename: `feedtubes-subscriptions-${date}.json`,
        text: JSON.stringify(
          {
            format: "feedtubes.subscriptions",
            version: 1,
            exportedAt: new Date().toISOString(),
            subscriptions: selected.map(exportObject),
          },
          null,
          2
        ),
        mime: "application/json",
      };
    case "youtube-csv": {
      const rows = [
        ["Channel Id", "Channel Url", "Channel Title"],
        ...youtubeSubscriptions(selected).map((subscription) => [
          subscription.channelId,
          subscription.channelUrl || `https://www.youtube.com/channel/${subscription.channelId}`,
          subscription.channelName,
        ]),
      ];
      return {
        filename: `youtube-subscriptions-${date}.csv`,
        text: serializeCsv(rows),
        mime: "text/csv;charset=utf-8",
      };
    }
    case "newpipe-json":
      return {
        filename: `newpipe-subscriptions-${date}.json`,
        text: JSON.stringify(
          {
            app_version: "0.27.6",
            app_version_int: 1003,
            subscriptions: youtubeSubscriptions(selected).map((subscription) => ({
              service_id: 0,
              url:
                subscription.channelUrl ||
                `https://www.youtube.com/channel/${subscription.channelId}`,
              name: subscription.channelName,
            })),
          },
          null,
          2
        ),
        mime: "application/json",
      };
    case "freetube-db": {
      const profile = {
        _id: "allChannels",
        name: "All Channels",
        bgColor: "#BD93F9",
        textColor: "#000000",
        subscriptions: youtubeSubscriptions(selected).map((subscription) => ({
          id: subscription.channelId,
          name: subscription.channelName,
          thumbnail: "",
        })),
      };
      return {
        filename: `freetube-subscriptions-${date}.db`,
        text: `${JSON.stringify(profile)}\n`,
        mime: "application/x-freetube-db",
      };
    }
    case "opml":
      return {
        filename: `feedtubes-subscriptions-${date}.opml`,
        text: exportOpml(selected),
        mime: "text/x-opml;charset=utf-8",
      };
    default:
      throw new Error("Unknown export format.");
  }
}
