# FeedTubes — PLAN_04 Implementation Plan

Multi-platform subscription aggregator with file-based subscriptions, instance management, a mixed feed, and scheduled background refresh.

## Confirmed decisions

| Topic                                | Decision                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Feed layout (`#1`)                   | **One column only**, mixed sources in a single chronological feed, with platform/channel filtering.                          |
| VK Video, Bilibili, Rumble           | Use the generic RSS/Atom adapter with user-supplied bridge URLs for MVP. Native adapters later.                              |
| Compatibility formats                | Support FreeTube `.db`, NewPipe JSON, OPML/XML, and YouTube/FreeTube CSV/JSON in addition to the unified format.             |
| Settings location                    | Tabs inside the sidebar: **Feed** and **Settings**. An optional full-page settings view can be added later.                  |
| Background refresh                   | **Enabled and configurable**: every 1 hour, every 3 hours, or every 6 hours. Default: 3 hours.                               |
| YouTube handles                      | Accept `UC...` IDs and `/channel/UC...` URLs first; best-effort `@handle` resolution with user confirmation.                 |
| PeerTube authenticated subscriptions | Out of scope. Use public channel APIs only.                                                                                  |
| Unified CSV                          | Keep 7 columns because bridge and generic feeds need `feed_url`. `#1` is interpreted as the feed layout, not the CSV schema. |

---

## 1. Research findings (`#1`)

### Platform reality

| Platform        | Subscription interchange                                                                                                                     | Feed endpoint                                                          | MVP approach                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| **YouTube**     | Google Takeout CSV: `Channel Id,Channel Url,Channel Title`; FreeTube exports CSV/JSON/OPML                                                   | `https://www.youtube.com/feeds/videos.xml?channel_id=UC...`            | Native RSS adapter               |
| **FreeTube**    | Imports YouTube CSV/JSON/OPML, NewPipe JSON, FreeTube `.db`. `.db` is NeDB newline-delimited JSON, not SQLite.                               | N/A                                                                    | Compatibility import/export only |
| **PeerTube**    | No CSV export. Authenticated `/api/v1/users/me/subscriptions`; account export is a ZIP with `activity-pub/following.json` and PeerTube JSON. | `GET {instance}/api/v1/video-channels/{handle}/videos`                 | Native public API adapter        |
| **Odysee**      | No standard subscription file                                                                                                                | `https://odysee.com/$/rss/@name:claimid`                               | Native RSS adapter               |
| **Rutube**      | No standard subscription file                                                                                                                | `https://rutube.ru/api/video/person/{id}/?sort=publication_d&limit=20` | Native JSON adapter              |
| **Dailymotion** | No standard subscription file                                                                                                                | `https://www.dailymotion.com/rss/user/{username}`                      | Native RSS adapter; API fallback |
| **VK Video**    | No stable public channel feed                                                                                                                | Requires VK API token or a third-party bridge                          | Generic RSS/bridge adapter       |
| **Bilibili**    | No native user-video RSS                                                                                                                     | RSSHub route or self-hosted RSSHub                                     | Generic RSS/bridge adapter       |
| **Rumble**      | No official channel RSS                                                                                                                      | Open RSS or self-hosted bridge                                         | Generic RSS/bridge adapter       |

**Verdict:** there is no cross-platform CSV standard. YouTube/FreeTube CSV is YouTube-only. PeerTube does not provide CSV subscription export. FeedTubes therefore defines its own unified CSV/JSON format and provides import adapters for existing formats.

### Unified CSV schema

```csv
platform,instance_url,channel_id,channel_name,channel_url,feed_url,enabled
youtube,https://www.youtube.com,UC_x5XG1OV2P6uZZ5FSM9Ttw,FreeCodeCamp,https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw,,true
peertube,https://video.ploud.fr,science,Ploud Science,https://video.ploud.fr/c/science/videos,,true
odysee,https://odysee.com,@OdyseeHelp,Odysee Help,https://odysee.com/@OdyseeHelp,,true
rutube,https://rutube.ru,23463954,Rutube Creator,https://rutube.ru/channel/23463954/,,true
dailymotion,https://www.dailymotion.com,vice,VICE,https://www.dailymotion.com/vice,,true
vkvideo,https://rsshub.app,vk_group,VK Channel,https://vkvideo.ru/vk_group,https://rsshub.app/vkvideo/group/vk_group,true
bilibili,https://rsshub.app,2267573,Bilibili UP,https://space.bilibili.com/2267573,https://rsshub.app/bilibili/user/video/2267573,true
rumble,https://openrss.org,SomeChannel,Rumble Creator,https://rumble.com/c/SomeChannel,https://openrss.org/rumble.com/c/SomeChannel,true
generic,https://example.com,,My Feed,https://example.com/channel,https://example.com/feed.xml,true
```

Column rules:

- `platform`: `youtube`, `peertube`, `odysee`, `rutube`, `dailymotion`, `vkvideo`, `bilibili`, `rumble`, `generic`.
- `instance_url`: canonical base for centralized platforms; instance URL for PeerTube; bridge/RSSHub base for bridge platforms.
- `channel_id`: platform-specific stable identifier. PeerTube handle, Odysee `@name:claimid`, Rutube numeric ID, Bilibili UID, Rumble slug, or blank for generic.
- `channel_name`: display name.
- `channel_url`: canonical channel page.
- `feed_url`: optional explicit feed URL. Required for `generic` and bridge-backed VK/Bilibili/Rumble.
- `enabled`: `true`/`false`.

### Unified JSON schema

```json
{
  "format": "feedtubes.subscriptions",
  "version": 1,
  "exportedAt": "2026-11-05T00:00:00.000Z",
  "subscriptions": [
    {
      "platform": "peertube",
      "instanceUrl": "https://video.ploud.fr",
      "channelId": "science",
      "channelName": "Ploud Science",
      "channelUrl": "https://video.ploud.fr/c/science/videos",
      "feedUrl": "",
      "enabled": true
    }
  ]
}
```

### Compatibility formats

Mandatory:

- Unified CSV and unified JSON.
- YouTube Takeout / FreeTube YouTube CSV.

Recommended:

- FreeTube `.db` (NeDB NDJSON) for YouTube subscriptions.
- NewPipe JSON (`subscriptions` array with `service_id`, `url`, `name`).
- OPML/XML for YouTube RSS subscriptions.

Optional:

- PeerTube `activity-pub/following.json` from an account export.
- YouTube JSON export from FreeTube.

---

## 2. File-based subscription layer (`#2`)

Firefox extensions cannot silently read/write arbitrary files, and Firefox does not support the File System Access API. The design is:

- **Canonical in-browser store:** JSON in `browser.storage.local`.
- **File portability:** first-class CSV/JSON import and export.
- **No external database or native companion.**

### Storage keys

```js
{
  schemaVersion: 1,
  subscriptions: [ /* unified subscription objects */ ],
  settings: {
    instances: [ /* instance definitions */ ],
    refresh: {
      intervalMinutes: 180, // 60, 180, or 360
      enabled: true
    },
    feed: {
      cacheTtlMinutes: 15,
      itemsPerSource: 20,
      maxItems: 200,
      concurrency: 4,
      timeoutMs: 15000
    },
    ui: {
      activeTab: "feed",
      platformFilter: "all",
      channelFilter: "all"
    }
  },
  cache: {
    "peertube|https://video.ploud.fr|science|": {
      fetchedAt: "2026-11-05T00:00:00.000Z",
      items: [],
      error: null
    }
  },
  refreshState: {
    running: false,
    startedAt: null,
    lastCompletedAt: null
  }
}
```

### Import workflow

1. Settings → Import/Export → file input (`accept=".csv,.json,.db,.opml,.xml"`).
2. Enforce a 5 MB file limit and 10,000-row limit.
3. Detect format by extension and content:
   - Unified JSON: `format === "feedtubes.subscriptions"`.
   - Unified CSV: header contains `platform`.
   - YouTube/FreeTube CSV: 3 columns in Takeout order.
   - FreeTube `.db`: each line parses as JSON and has `subscriptions`.
   - NewPipe JSON: top-level `subscriptions` array.
   - OPML/XML: `<opml>` root.
4. Normalize every row:
   - Trim strings.
   - Validate platform.
   - Validate URLs; allow only `http:`/`https:`.
   - Derive `channelId` from `channelUrl` where possible.
   - Reject `javascript:`, `data:`, `file:`, `blob:`, and credentialed URLs.
5. Deduplicate by `platform + normalized instance host + channelId`; fall back to `feedUrl`.
6. Show a preview summary: valid, invalid, duplicates, by platform.
7. Choose merge mode:
   - **Merge** (default): add new; update metadata on duplicates; keep existing `enabled` state.
   - **Skip duplicates**: add new only.
   - **Replace**: clear existing subscriptions after confirmation.
8. Show a result report with row numbers for failures.

### Export workflow

1. Choose format:
   - Unified CSV.
   - Unified JSON.
   - YouTube/FreeTube-compatible CSV.
   - FreeTube `.db` (YouTube subscriptions only).
   - NewPipe JSON.
   - OPML (optional).
2. Choose scope: all / enabled only.
3. Serialize, create a `Blob`, trigger a download through an anchor with `download`, then revoke the object URL.
4. Filename: `feedtubes-subscriptions-YYYY-MM-DD.csv` / `.json` / `.db`.

### CSV rules

- RFC 4180 parsing: quoted fields, escaped `""`, embedded commas and newlines.
- UTF-8 with optional BOM; accept LF and CRLF.
- Case-insensitive header aliases (`channel_id`, `Channel ID`, `channelid`, etc.).
- Skip blank lines.
- Quote every exported field.
- Neutralize leading `=`, `+`, `-` on export for spreadsheet safety; do not mangle `@` handles.

### Validation and dedupe

- Platform enum.
- Required fields per platform.
- URL scheme and host validation.
- Maximum field lengths.
- Duplicate detection and merge reporting.
- Storage migration via `schemaVersion`.

---

## 3. Feed UI (`#5` and confirmed `#1`)

The Feed tab is a **single-column mixed feed**:

- All enabled platforms are interleaved and sorted newest first.
- No multi-column grid; cards fill the sidebar width.
- Platform filter chips/dropdown: All, YouTube, PeerTube, Odysee, Rutube, Dailymotion, VK, Bilibili, Rumble, RSS.
- Optional channel filter: All channels or a specific subscription.
- Filter state persists in `settings.ui`.

Each card shows:

1. **Preview thumbnail** — 16:9 image, lazy-loaded, `referrerpolicy="no-referrer"`.
2. **Source badge** — platform label.
3. **Source channel name**.
4. **Title** — multi-line, truncated.
5. **Published date** — relative time with absolute date in `title`.

```html
<article class="video-card">
  <a class="video-card__link" href="https://..." data-url="https://...">
    <div class="video-card__thumb">
      <img src="..." alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
      <span class="platform-badge platform-badge--peertube">PeerTube</span>
    </div>
    <div class="video-card__meta">
      <h3 class="video-card__title">Video title</h3>
      <p class="video-card__channel">Ploud Science</p>
      <time class="video-card__date" datetime="2026-11-05T10:00:00Z">5 hours ago</time>
    </div>
  </a>
</article>
```

Behavior:

- Merge all enabled sources, deduplicate by platform item ID or URL, sort newest first.
- Show 60 items initially with “Show more”; cap at 200.
- Render cached items immediately, then refresh stale sources.
- Manual refresh button plus “Last updated …”.
- Partial failure banner: “3 of 12 sources failed” with expandable details.
- Empty states: no subscriptions → CTA to Settings/Import; no items → “No recent videos”.
- Skeleton loading cards, respecting `prefers-reduced-motion`.
- Thumbnail fallback: gradient placeholder with platform initial if the image fails.
- Relative time via `Intl.RelativeTimeFormat`; refresh labels every minute while the sidebar is open.
- Accessibility: keyboard focus, `aria-live` status, text labels for badges, no color-only meaning.

---

## 4. Settings tab (`#3`)

The sidebar page has two accessible tabs:

1. **Feed**
2. **Settings**

Use `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, arrow-key navigation, and persisted active tab.

### Settings sections

**A. Instances**

- List configured instances: kind, label, base URL, default badge, test status, remove.
- Add instance form:
  - Kind: PeerTube, RSSHub, VK bridge, Bilibili bridge, Rumble bridge, Generic.
  - Base URL and label.
  - “Test connection” button.
- Default instance per kind, used by the Add Subscription form.
- Fixed platforms (YouTube, Odysee, Rutube, Dailymotion) show their canonical base and are not editable.
- Deleting an instance removes it from the picker but does not break existing subscriptions, because each subscription stores its own `instanceUrl`.

**B. Subscriptions**

- Add form:
  - Platform.
  - Instance select or canonical base.
  - Channel ID / URL / handle.
  - Optional display name.
  - Optional feed URL for generic/bridge platforms.
  - Enabled checkbox.
- Search and platform filter.
- Per-row enable/disable toggle, edit, delete.
- Bulk actions: enable all, disable all, delete disabled.
- Duplicate detection and inline validation.

**C. Automatic Fetching**

- Select: **Every 1 hour**, **Every 3 hours**, **Every 6 hours**.
- Default: 3 hours.
- Changes reschedule the background alarm immediately.
- Manual refresh remains available in the Feed tab.

**D. Import / Export**

- Import card with format summary, merge-mode selection, and result report.
- Export card with format and scope selection.

**E. Data & About**

- Storage usage estimate.
- Clear cache.
- Reset all data with confirmation.
- Version and documentation links.

### Permission UX

- `browser.permissions.request()` must run inside a user gesture (Add, Test, Refresh).
- Check `browser.permissions.contains()` before fetching.
- If permission is denied:
  - Save the subscription if the user wants.
  - Mark it as “permission required” in the feed.
  - Show a “Grant access” action.
- Listen to `permissions.onRemoved` and mark affected subscriptions.
- Request the narrowest origin, e.g. `https://video.ploud.fr/*`, even though the manifest lists a broad optional pattern.

---

## 5. Background refresh

Firefox MV3 uses a background **event page**, not a service worker.

### Manifest

```json
{
  "permissions": ["storage", "alarms"],
  "optional_host_permissions": ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
  "background": {
    "scripts": ["background/background.js"],
    "type": "module"
  }
}
```

No `"tabs"`, `"downloads"`, `"scripting"`, `"cookies"`, or install-time `host_permissions`.

### Alarm behavior

- Alarm name: `ytf-refresh`.
- `onInstalled` and `onStartup`: read settings, ensure the alarm exists with `periodInMinutes` set to 60, 180, or 360.
- `onAlarm`: if the name matches, run `refreshAllFeeds({ reason: "alarm" })`.
- Settings change: clear and recreate the alarm immediately.
- Default interval: 180 minutes.

### Refresh flow

1. Load subscriptions and settings.
2. Filter enabled subscriptions.
3. Check host permissions; skip missing and record a `permission-required` error.
4. Fetch with concurrency 4, timeout 15 seconds, retry once on network/5xx.
5. Parse through the platform adapters; validate items; cap 20 per source.
6. Update `cache` per subscription and `refreshState.lastCompletedAt`.
7. Notify an open sidebar via `runtime.sendMessage({ type: "feed-updated" })`.
8. Guard against overlapping runs with `refreshState.running`; reset if a run has been stuck for more than 5 minutes.

### Sidebar interaction

- On open: render cache immediately; refresh if cache is older than the TTL.
- Listen for `feed-updated` and re-render if the Feed tab is active.
- Background refresh works while the sidebar is closed; the next open shows the updated cache.

### Lifecycle caveat

Event pages can be terminated when idle. Keep refresh work bounded with timeouts and concurrency limits. If a run is interrupted, the next alarm or sidebar open retries.

---

## 6. Opening videos in new tabs (`#4`)

Use semantic links plus the WebExtensions API:

```js
browser.tabs.create({
  url: validatedUrl,
  active: !event.ctrlKey && !event.metaKey,
});
```

Rules:

- No `"tabs"` permission.
- Validate the URL with `new URL()` and allow only `http:`/`https:`.
- Use an `<a href>` for accessibility and middle-click support; intercept the primary click with `preventDefault()`.
- Respect Ctrl/Cmd-click as “open in background tab” if desired.
- Show a toast if `tabs.create` fails.
- Never open `javascript:`, `data:`, `file:`, or malformed URLs.

---

## 7. Platform adapters

| Platform    | Adapter            | Input                              | Endpoint                                           | Permission                      |
| ----------- | ------------------ | ---------------------------------- | -------------------------------------------------- | ------------------------------- |
| YouTube     | Native RSS         | `UC...` ID or `/channel/UC...` URL | `youtube.com/feeds/videos.xml?channel_id=`         | `https://www.youtube.com/*`     |
| PeerTube    | Native API         | Channel handle or URL + instance   | `{instance}/api/v1/video-channels/{handle}/videos` | Instance origin                 |
| Odysee      | Native RSS         | `@name:claimid` or channel URL     | `odysee.com/$/rss/...`                             | `https://odysee.com/*`          |
| Rutube      | Native JSON        | Numeric ID or channel URL          | `rutube.ru/api/video/person/{id}/`                 | `https://rutube.ru/*`           |
| Dailymotion | Native RSS         | Username or channel URL            | `dailymotion.com/rss/user/{username}`              | `https://www.dailymotion.com/*` |
| VK Video    | Generic RSS/bridge | Bridge feed URL                    | User-supplied RSS                                  | Bridge origin                   |
| Bilibili    | Generic RSS/bridge | RSSHub URL + UID                   | User-supplied RSS                                  | RSSHub origin                   |
| Rumble      | Generic RSS/bridge | Open RSS/self-hosted URL           | User-supplied RSS                                  | Bridge origin                   |
| Any         | Generic RSS/Atom   | Feed URL                           | User-supplied                                      | Feed origin                     |

Adapter contract:

```js
{
  id: "youtube",
  label: "YouTube",
  defaultInstanceUrl: "https://www.youtube.com",
  validate(subscription) { /* return error strings */ },
  async fetch(subscription, { fetchText, fetchJson, fetchXml, signal }) { /* FeedItem[] */ },
  async resolve(input, context) { /* optional metadata lookup */ }
}
```

Normalized feed item:

```js
{
  id: "video-id",
  platform: "youtube",
  channelId: "UC...",
  channelName: "Channel",
  title: "Video title",
  url: "https://...",
  thumbnailUrl: "https://...",
  publishedAt: "2026-11-05T10:00:00.000Z"
}
```

### YouTube handle resolution

- Accept `UC...` IDs and `/channel/UC...` URLs directly.
- For `@handle`, fetch the channel page and extract the channel ID on a best-effort basis.
- Show the resolved ID/name and ask the user to confirm before saving.
- If resolution fails, ask for the `UC...` ID.

---

## 8. Architecture

```text
src/
├── manifest.json
├── background/
│   └── background.js
├── sidebar/
│   ├── sidebar.html
│   ├── sidebar.css
│   ├── sidebar.js
│   ├── views/
│   │   ├── feed-view.js
│   │   └── settings-view.js
│   └── components/
│       ├── tabs.js
│       ├── video-card.js
│       └── toast.js
├── lib/
│   ├── storage.js
│   ├── subscriptions.js
│   ├── import-export.js
│   ├── csv.js
│   ├── url.js
│   ├── time.js
│   ├── permissions.js
│   ├── fetch.js
│   ├── refresh.js
│   ├── alarms.js
│   ├── dom.js
│   └── platforms/
│       ├── registry.js
│       ├── youtube.js
│       ├── peertube.js
│       ├── odysee.js
│       ├── rutube.js
│       ├── dailymotion.js
│       └── generic-rss.js
└── icons/
```

Shared modules must work in both the sidebar and the background event page. Keep DOM code out of `lib/` so background imports do not touch `document`.

---

## 9. Security and privacy

- All feed data is untrusted.
- Use `textContent` and DOM construction; no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, or `new Function`.
- Validate every URL and allow only `http:`/`https:`.
- Cap title/channel lengths.
- Parse XML with `DOMParser`; do not fetch external entities.
- Keep the default MV3 CSP. If remote thumbnails are blocked, extend only `img-src` to `'self' https: data:`.
- Thumbnails load directly from platforms; document the IP/privacy implication. A future thumbnail proxy/cache would need host permissions and storage.
- Treat bridge URLs as user-supplied network destinations; warn when using third-party bridges.
- Keep `data_collection_permissions.required: ["none"]`; re-audit before release because feed requests go directly to platforms and bridge services.

---

## 10. Implementation phases

### Phase A — Data layer and UI shell

- Manifest permissions (`storage`, `alarms`, optional host permissions).
- Storage schema and migration.
- Unified CSV/JSON parser and serializer.
- YouTube Takeout CSV import.
- Settings tab with subscription CRUD, instance manager, import/export.
- Feed tab empty/loading shell and one-column layout.
- Unit tests for CSV, JSON, normalization, dedupe.

### Phase B — Feed adapters, feed rendering, background refresh

- Permission helper and fetch helper with timeout/retry/concurrency.
- YouTube, PeerTube, Odysee, Rutube, Dailymotion adapters.
- Generic RSS/Atom adapter.
- Cache and refresh pipeline.
- Background event page, alarms, configurable 1h/3h/6h intervals.
- Video cards, new-tab behavior, relative dates, badges, error states.
- Adapter fixture tests and alarm scheduling tests.

### Phase C — Bridges and compatibility

- VK Video, Bilibili, Rumble via generic RSS/bridge presets.
- FreeTube `.db`, NewPipe JSON, OPML, YouTube JSON import/export.
- Optional PeerTube `activity-pub/following.json` import.
- Full documentation and troubleshooting.

### Phase D — Hardening and release

- Accessibility, theme, zoom, narrow-width checks.
- Firefox/LibreWolf on Linux and Windows.
- Rate-limit and failure handling.
- Version bump to `0.2.0`, docs, lint, tests, build.

---

## 11. Testing and acceptance

Automated:

- `bun test` for pure modules.
- Fixtures for YouTube XML, PeerTube JSON, Odysee XML, Rutube JSON, Dailymotion XML, RSS, unified CSV/JSON, YouTube Takeout CSV, FreeTube `.db`, NewPipe JSON, malformed files.
- Tests for CSV quoting/BOM/CRLF, format detection, URL validation, dedupe, merge modes, adapter parsing, and alarm interval calculation.
- `bun run lint`, `bun run format:check`, `bun run build`.

Manual:

- Set the fetch interval to 1 hour; use the background console to trigger the alarm for a faster test.
- Confirm the cache updates while the sidebar is closed.
- Confirm changing the interval reschedules the alarm.
- Confirm the sidebar re-renders when it receives `feed-updated`.
- Confirm permission-denied subscriptions are skipped without breaking other sources.

Acceptance criteria:

- **#1:** Research documented; unified schema implemented; YouTube, PeerTube, Odysee, Rutube, Dailymotion native; VK/Bilibili/Rumble via documented bridge/RSS.
- **#2:** Subscriptions persist as JSON in `storage.local`; CSV/JSON import/export works and round-trips; YouTube Takeout CSV imports.
- **#3:** Settings tab manages instances, subscriptions, fetch interval, and import/export; changes persist.
- **#4:** Clicking a card opens the video in a new tab without disturbing the sidebar.
- **#5:** Every card shows thumbnail, source badge, channel, title, and published date, with fallback/error states.
- **Feed layout:** one column, mixed sources, platform/channel filtering.
- **Background refresh:** configurable 1h/3h/6h alarm refreshes cache; default 3h.
- **Permissions:** `storage`, `alarms`, and optional host permissions only; no `tabs`.

---

## 12. References

- FreeTube subscription import/export: <https://docs.freetubeapp.io/usage/importing-subscriptions/>
- FreeTube `.db` is NeDB NDJSON: <https://github.com/FreeTubeApp/FreeTube/issues/4567>
- PeerTube REST API: <https://docs.joinpeertube.org/api-rest-reference.html>
- PeerTube subscription export discussion: <https://github.com/Chocobozzz/PeerTube/pull/6215>
- Odysee RSS guide: <https://web.emhmki.org/guides/rss_software/guide_to_retrieve_rss_feed_addresses.html>
- Rutube JSON endpoint: <https://pashkof.ru/articles/kak-vstavit-video-s-rutube-na-svoj-sajt/>
- Dailymotion RSS: <https://www.dailymotion.com/dmrss>
- RSSHub Bilibili routes: <https://rsshub-docs-mirror.github.io/routes/bilibili>
- Open RSS Rumble: <https://openrss.org/feeds/rumble>
- MDN `tabs.create()`: <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create>
- MDN `optional_host_permissions`: <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions>
- MDN `background`: <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background>
- MDN `alarms`: <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms>
