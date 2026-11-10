# Architecture

## Overview

FeedTubes is a Manifest V3 WebExtension for Firefox and LibreWolf. Its UI is a sidebar panel registered with `sidebar_action`; a background script refreshes feeds on a timer.

All code is TypeScript under `src/`. `tsc` compiles it one file per module into `build/`, next to copies of the static assets. `build/` is what the browser loads and what `web-ext` packages. No bundler is involved, so every shipped `.js` file maps 1:1 to a `.ts` source file.

```text
src/
  manifest.json
  background/background.ts      alarm + refresh orchestration, message handlers
  lib/                          shared, DOM-light logic (also used by tests)
    types.ts                    domain model (Subscription, FeedItem, Settings, …)
    messages.ts                 typed sidebar ⇄ background message protocol
    storage.ts                  browser.storage.local access + state normalization
    subscriptions.ts            normalization, keys, dedupe/merge
    import-export.ts            file format detection, parsers, exporters
    refresh.ts                  concurrent refresh of all enabled subscriptions
    fetch.ts                    fetch with timeout, retries, credentials omitted
    permissions.ts, alarms.ts   thin wrappers over browser APIs
    url.ts, time.ts, csv.ts, xml.ts, text.ts, guards.ts, errors.ts, dom.ts
    platforms/
      registry.ts               one PlatformDefinition per platform
      youtube.ts, peertube.ts, rutube.ts, odysee.ts, dailymotion.ts, dtube.ts, pixabay.ts,
      generic-rss.ts
  sidebar/
    sidebar.html, sidebar.css
    sidebar.ts                  App controller (implements AppContext)
    app-context.ts              what views may read and do
    components/                 tabs, toast, video card
    views/feed-view.ts
    views/settings-view.ts      composes views/settings/*-section.ts
```

## Platforms

`lib/platforms/registry.ts` is the single source of truth for platforms. Each `PlatformDefinition` carries:

- label and `kind` (`native`, `bridge`, `generic`)
- `adapter` (`PlatformAdapter`: `fetchItems`, optional `feedUrlFor`)
- default instance and fixed host permission
- whether an instance or a feed URL is required
- the instance kind offered in the form, and the form placeholder

The record is checked with `satisfies Record<PlatformId, PlatformDefinition>`, so adding a `PlatformId` without a definition is a compile error.

To add a platform:

1. Add its id to `PlatformId` in `types.ts`.
2. Write an adapter. For RSS/Atom sources, `createFeedAdapter(feedUrlFor)` in `generic-rss.ts` is enough.
3. Register it in `PLATFORMS`.
4. Add a normalizer in `subscriptions.ts` if its channel URLs need parsing.

### YouTube

YouTube's feed only accepts `UC…` channel ids. Handles, bare names (stored as `@name`) and `/@name`, `/c/…` or `/user/…` URLs are resolved when a subscription is saved, and on the fly for older subscriptions saved unresolved.

`youtube.ts` uses two sources, in order:

1. **Channel lookup:** YouTube's internal `navigation/resolve_url` API (`youtube-innertube.ts`). The fallback is the channel page with `?ucbcb=1`. Without that parameter, cookieless requests from the EU are redirected to `consent.youtube.com`, which the extension cannot read, and Firefox reports a `NetworkError`.
2. **Videos:** the public RSS feed (`/feeds/videos.xml`), which has exact dates. When the feed fails, the extension reads the channel's Videos tab through the internal `browse` API instead.
   - The fallback was added because, as of November 2026, the feed returned HTTP 404/500 for every channel.
   - Dates from the fallback are approximate, because YouTube only gives "3 days ago".
   - The internal API is undocumented, so all of its fields are read defensively.
   - An empty Videos tab is reported as an error, since that more likely means a changed response format than a channel with no uploads.

### Pixabay

Pixabay subscriptions follow one contributor through the official video API (`pixabay.com/api/videos/`).

- **API key:** every request needs the user's personal, free key. It's entered under Settings → General → API Keys and stored in `settings.apiKeys`. Exports contain only subscriptions, so the key never leaves the browser except in requests to Pixabay.
- **No key in messages:** `errors.ts` redacts credential query parameters (`key`, `token`, …) from every HTTP and network error, so a failed request can't put the key into the error banner or the cache.
- **Contributor filter:** the API has none. The adapter searches `q=user:<name>` (undocumented syntax) and keeps only hits whose `user_id` or `user` matches. If Pixabay ignores the syntax, the source reports "no videos" rather than showing unrelated footage.
- **Dates:** results have no upload time, only the upload day in the CDN path, so dates are day-precise.
- **24-hour cooldown:** Pixabay asks API users to cache results for a day. The registry entry sets `refreshCooldownMs` to 24 hours, applied only after a successful fetch, so a failed fetch (for example, a missing key) retries on the normal cooldown.

## Message protocol

Defined in `lib/messages.ts`:

| Direction            | Type               | Response                                       |
| -------------------- | ------------------ | ---------------------------------------------- |
| sidebar → background | `refresh-request`  | `Result<{ total, failures, completedAt }>`     |
| sidebar → background | `settings-changed` | `Result` (the alarm is rescheduled)            |
| sidebar → background | `alarm-info`       | `Result<{ alarm }>`                            |
| background → sidebar | `feed-updated`     | event: `{ reason, total?, failures?, error? }` |

The background script answers through a typed handler map (`{ [T in RequestType]: () => Promise<RequestResponses[T]> }`). Only one refresh runs at a time; concurrent requests share the promise of the one in flight.

Each subscription is fetched at most once per 5 minutes (`REFRESH_COOLDOWN_MS` in `refresh.ts`), whether the refresh comes from the Refresh button, opening the sidebar, or the alarm.

- Skipped subscriptions keep their cached entry. The response reports `throttled` and `nextRefreshAt`, and the manual-refresh toast shows the wait time.
- Sources that failed only for missing host access are never held back, so "Grant access" loads them right away.

## Sidebar

`sidebar.ts` loads state, creates the views and wires the tabs. Views get an `AppContext`, not the storage layer, so all writes go through one place that also re-renders every view.

The settings panel is split into independent sections (instances, subscriptions, refresh, import/export, data), each with `render()`/`reset()`.

Required DOM elements are looked up with `getElement(id, HTMLXElement)`, which throws on a markup/code mismatch instead of failing later on `null`.

Adding a YouTube `@handle` resolves it to a `UC…` channel id when the subscription is saved, because YouTube's feed endpoint only accepts channel ids.

## Permissions

- `storage` and `alarms` are required.
- Hosts are `optional_host_permissions`, requested per subscription origin:
  - when the user grants access from the feed
  - when testing an instance
  - when resolving a YouTube handle

  Requests are made before any `await` in the click/submit handler, so they still count as user actions.

- `fetch` always uses `credentials: "omit"` and `cache: "no-store"`.

## Security model

- Default MV3 content security policy; no inline scripts, `eval`, or remote code.
- All feed and import data is treated as untrusted:
  - JSON is narrowed with `lib/guards.ts`.
  - URLs must pass `parseHttpUrl` (http/https only, no embedded credentials).
  - Titles are truncated.
- The DOM is built with `createEl`/`textContent` only. ESLint's `no-unsanitized` rules reject HTML sinks.
- CSV exports neutralize spreadsheet formulas.
- No data leaves the browser except requests to the platforms and bridges the user configures, so `data_collection_permissions` declares `none`.

## Theming and accessibility

- `--ytf-*` custom properties are defined for light and dark (`prefers-color-scheme`); `color-scheme: light dark` covers form controls.
- The tabs follow the WAI-ARIA tablist pattern (roving tabindex; arrow, Home and End keys).
- Status regions use `role="status"` / `aria-live`.

## Packaging boundary

`web-ext-config.mjs` sets `sourceDir: "build"` and `artifactsDir: "dist"`, so the zip contains only compiled JavaScript and static assets: no `.ts`, tests, docs or tooling. AMO reviewers need the TypeScript sources submitted alongside, since the shipped code is generated.
