# Architecture

## Overview

FeedTubes is a Manifest V3 WebExtension for Firefox and LibreWolf. Its UI is a sidebar panel registered with `sidebar_action`; a background script refreshes feeds on a timer.

All code is TypeScript under `src/`. `tsc` compiles it one file per module into `build/`, next to copies of the static assets. `build/` is what the browser loads and what `web-ext` packages. No bundler is involved, so every shipped `.js` file maps 1:1 to a `.ts` source file. The one exception is `build/vendor/fluent-bundle/`, the unmodified ES module build of the `@fluent/bundle` dependency.

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
    refresh.ts                  due selection, batches, failure backoff
    throttle.ts                 per-host spacing, hourly budget, pause on refusals
    fetch.ts                    fetch with timeout, retries, credentials omitted
    permissions.ts, alarms.ts   thin wrappers over browser APIs
    url.ts, time.ts, csv.ts, xml.ts, text.ts, guards.ts, errors.ts, dom.ts
    platforms/
      registry.ts               one PlatformDefinition per platform
      youtube.ts, peertube.ts, rutube.ts, odysee.ts, dailymotion.ts, dtube.ts, pixabay.ts,
      twitch.ts, goodgame.ts, generic-rss.ts
    twitch-auth.ts              "Sign in with Twitch" (OAuth implicit grant)
    i18n/
      index.ts                  Fluent bundles, language choice, t(), LocalizedText
      format.ts                 dates, relative times, units, lists via Intl
      isv-cyrillic.ts           Interslavic Latin → Cyrillic
      keys.ts                   MessageKey type, generated from eng/feedtubes.ftl
      dom.ts                    translates data-i18n markup
  locales/<ISO 639-3>/feedtubes.ftl   eng, rus, deu, isv-Latn
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
   - Requests identify as YouTube's own web client: `clientName: WEB`, plus the `X-YouTube-Client-Name`/`-Version` headers. The version is read once a day from `/sw.js_data`, falling back to a built-in one, because YouTube rejects outdated versions. Nothing else is disguised. Origin and Referer stay as the browser sends them.

### Pixabay

Pixabay subscriptions follow one contributor through the official video API (`pixabay.com/api/videos/`).

- **API key:** every request needs the user's personal, free key. It's entered under Settings → Instances → API Keys and stored in `settings.apiKeys`. Exports contain only subscriptions, so the key never leaves the browser except in requests to Pixabay.
- **No key in messages:** `errors.ts` redacts credential query parameters (`key`, `token`, …) from every HTTP and network error, so a failed request can't put the key into the error banner or the cache.
- **Contributor filter:** the API has none. The adapter searches `q=user:<name>` (undocumented syntax) and keeps only hits whose `user_id` or `user` matches. If Pixabay ignores the syntax, the source reports "no videos" rather than showing unrelated footage.
- **Dates:** results have no upload time, only the upload day in the CDN path, so dates are day-precise.
- **24-hour cooldown:** Pixabay asks API users to cache results for a day. The registry entry sets `refreshCooldownMs` to 24 hours, applied only after a successful fetch, so a failed fetch (for example, a missing key) retries on the normal cooldown.

### Twitch

A Twitch subscription is read in one of two ways:

- **RSS bridge:** when the subscription has a feed URL, e.g. an RSSHub `/twitch/video/<login>` route, it is read like any feed. No Twitch account is needed, and host permission is requested for the bridge.
- **Official Helix API:** otherwise. It requests `users?login=`, then `videos?user_id=` (exact dates) and `streams?user_login=` in parallel; a live stream appears as an extra "LIVE: …" card at the top.

Helix needs a Client ID and a user token:

- **Client ID:** every user registers a free application at dev.twitch.tv (category "Website Integration") and enters its Client ID under Settings → Instances → API Keys. Settings shows the redirect URL to register, which comes from `browser.identity.getRedirectURL()` and depends on the extension ID.
- **Token:** "Sign in with Twitch" (`twitch-auth.ts`) uses the OAuth implicit grant through `browser.identity.launchWebAuthFlow`. It needs no client secret and requests no scopes, and it checks the `state` value against forged redirects. The token is validated with `id.twitch.tv/oauth2/validate`, stored in `settings.apiKeys`, and revoked on sign-out.
- **Expiry:** an expired token shows "sign in again", and changing the Client ID signs the user out.
- **What's not used:** Twitch's internal GraphQL API with the twitch.tv website's own client ID. That would impersonate Twitch's app and breaks Twitch's terms.

### goodgame.ru

goodgame.ru has no public list of past videos, so a subscription shows **one status card** per channel, from `goodgame.ru/api/4/users/<channel>/stream`:

- **Live:** "LIVE: <title> (<game>)" with the stream preview.
- **Offline:** "Last stream: <title> (<game>)" with the channel poster, dated when the channel was last online.
- **One card per channel:** the card's id is the channel name, so each refresh updates it instead of adding a new one.
- **Unknown channels:** the API answers 404, which is shown as "no channel named …".

## Message protocol

Defined in `lib/messages.ts`:

| Direction            | Type               | Response                                                            |
| -------------------- | ------------------ | ------------------------------------------------------------------- |
| sidebar → background | `refresh-request`  | `Result<RefreshSummary>` (Refresh button)                           |
| sidebar → background | `refresh-due`      | `Result<RefreshSummary>` (sidebar opened)                           |
| sidebar → background | `settings-changed` | `Result` (the alarm is rescheduled)                                 |
| sidebar → background | `alarm-info`       | `Result<{ alarm }>`                                                 |
| background → sidebar | `feed-updated`     | event: `{ reason, total?, failures?, fetched?, progress?, error? }` |

The background script answers through a typed handler map (`{ [T in RequestType]: () => Promise<RequestResponses[T]> }`). Only one refresh runs at a time; concurrent requests share the promise of the one in flight.

## Refresh at scale

Lists of thousands of subscriptions must neither freeze the sidebar nor get the user's IP blocked. A refresh therefore fetches little, slowly, and stops when a host refuses.

**What is fetched (`refresh.ts`):**

- **Cache first:** the feed is always shown from `storage.local`, also after a browser restart. A refresh only fetches subscriptions that are **due**.
- **Check interval:** the "Check each subscription" setting (`refresh.intervalMinutes`, 1–24 h). Channels whose newest video is over a week old are checked half as often; over a month old, at most once a day.
- **Modes:** the alarm and opening the sidebar fetch only due subscriptions (`due`). The Refresh button ignores the interval but keeps the 5 minute cooldown (`REFRESH_COOLDOWN_MS`) and the failure backoff (`manual`).
- **Failure backoff:** a failing source waits 5 min, doubling with each failure in a row, up to a day (`CacheEntry.failures`). Sources that failed only for missing host access are never held back, so "Grant access" loads them right away.
- **Batches:** at most `MAX_SOURCES_PER_RUN` (100) sources per run, never-fetched first, then the longest overdue. The rest is reported as `pending`. The background saves the cache and notifies the sidebar every `PROGRESS_EVERY` (25) sources, so the feed fills in while a run goes on. When sources remain, a one-shot alarm (`REFRESH_CONTINUE_ALARM`) runs the next batch two minutes later. The periodic alarm wakes at most every 30 minutes and sends nothing when nothing is due.

**How fast (`throttle.ts`):** every request of a run goes through one host throttle. Its limits are constants (`HOST_POLICIES`), not settings:

| Limit              | `www.youtube.com`              | Other hosts |
| ------------------ | ------------------------------ | ----------- |
| In flight          | 1                              | 2           |
| Gap between starts | 1 s + up to 0.5 s jitter       | 0.3 s       |
| Pause              | 8–15 s after every 50 requests | none        |
| Requests per hour  | 900                            | 1500        |

- **Pause on refusal:** three HTTP 429/403 answers in a row pause the host for 30 minutes, doubling up to 12 hours (or longer if `Retry-After` asks for it). A success clears the pause.
- **Deferred, not failed:** sources of a paused or over-budget host keep their cache entry and are counted as `deferred`. The continuation alarm waits until the host is available again.
- **Stored:** the hourly usage and pauses are stored (`hostLimits`), so they hold across runs and background restarts.
- **Retries:** the throttle sends with `retries: 0` and retries a transient failure once itself, through the gate. `fetch.ts` never retries 429.

## Sidebar

`sidebar.ts` loads state, creates the views and wires the tabs. Views get an `AppContext`, not the storage layer, so all writes go through one place that also re-renders every view.

The settings panel is split into independent sections (instances, subscriptions, refresh, import/export, data), each with `render()`/`reset()`.

Required DOM elements are looked up with `getElement(id, HTMLXElement)`, which throws on a markup/code mismatch instead of failing later on `null`.

Adding a YouTube `@handle` resolves it to a `UC…` channel id when the subscription is saved, because YouTube's feed endpoint only accepts channel ids.

## Permissions

- `storage`, `alarms`, and `identity` are required. `identity` is used only for "Sign in with Twitch".
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

## Interface language

FeedTubes translates its interface with [Project Fluent](https://projectfluent.org/) (`@fluent/bundle`), in `src/lib/i18n/`. Firefox's `browser.i18n` always follows the browser's language, can't be switched inside the add-on, and has no Interslavic. The rules behind this section are in [DEVELOPMENT.md](DEVELOPMENT.md#internationalisation-rules).

- **Languages:** identified by ISO 639-3 code, with an ISO 15924 script where a language has several: `eng`, `rus`, `deu`, `isv-Latn`, `isv-Cyrl`. `LANGUAGE_TAGS` maps them to BCP 47 (`en`, `ru`, `de`, …) for `Intl` and `<html lang>`.
- **Messages:** one Fluent file per language, `src/locales/<code>/feedtubes.ftl`, with `eng` as the source.
  - Arguments are `{ $name }`. Countable text uses selectors (`{ $count -> [one] … *[other] … }`), resolved with `Intl.PluralRules`.
  - `src/lib/i18n/keys.ts` is generated from the English file (`bun run i18n:keys`), so `t()` only accepts existing ids.
- **Loading:** `loadLocales()` fetches every `.ftl` file packaged with the extension once per context: the sidebar before its first render, the background before its first refresh. It builds one `FluentBundle` per language with `useIsolating: false`, so no invisible bidi marks end up in the text. Switching the language and `t()` are synchronous afterwards.
- **Interslavic:**
  - **Plurals and numbers:** its bundle has the locales `["isv-Latn", "ru"]`, so plural rules and number formatting fall back to Russian, whose one/few/many pattern Interslavic shares.
  - **Cyrillic:** generated from the Latin file by `transliterateFtl()` when it loads, so both scripts always match. Only message text changes. Ids, variant keys, `{ $arguments }`, brand names, URLs, domains and abbreviations (RSS, URL, API…) stay as written, and arguments like channel names are inserted afterwards, never transliterated.
- **Choosing the language:** `settings.ui.language` is `"auto"` (default) or one of the codes above. Values saved by older versions (`en`, `ru`, `de`) are mapped when the settings load.
  - "Automatic" follows `browser.i18n.getUILanguage()` when it is English, Russian or German, otherwise Russian.
  - `applyLanguageSetting()` activates it: in the sidebar on every render, in the background before each refresh.
- **Formatting (`format.ts`):** all of it goes through `Intl`, in the active language:
  - video dates: `Intl.DateTimeFormat`, numeric, 24-hour (`05.11.2026, 16:01` in German)
  - "Updated 3 minutes ago": `Intl.RelativeTimeFormat`
  - wait times and storage size: `Intl.NumberFormat` units (`3 min`, `1.5 kB`)
  - lists: `Intl.ListFormat`, e.g. the parts of the Fetch summary

  Interslavic has no CLDR data, so `lacksCldrData()` sends these to the `cldr-*` messages of `isv-Latn/feedtubes.ftl` instead.

- **Code:** `t(id, args)` returns the text in the active language. Several sentences are shown one per line (`setMessage` with an array) rather than joined into one string.
- **Markup:** `sidebar.html` marks text with `data-i18n`, `data-i18n-placeholder`, `data-i18n-title` and `data-i18n-aria-label`. `applyTranslations()` sets them with `textContent`/`setAttribute` only, never HTML, and updates `<html lang>`. Multi-line hints use one `.hint__line` element per line instead of `<br>`.
- **Stored and transmitted text is locale-independent:**
  - **Errors:** adapters throw `LocalizedError`, which keeps its message id and arguments. The cache stores `CacheEntry.error` as `LocalizedText` (`{ id, args }`, possibly nested for a wrapped cause), and the message protocol sends errors the same way. The sidebar translates them when shown, so a language change applies to stored errors at once. Errors from outside FeedTubes (browser, network stack) keep their own text as the argument of `error-raw`.
  - **Titles:** items keep the platform's own title. Stream cards carry `stream: "live" | "last"` and `game`, and the card adds the translated "LIVE:" / "Last stream:" label. Items without a title get the translated "Untitled video" when shown.
  - **Schema:** `SCHEMA_VERSION` 2 marks this format. A cache from version 1, which held translated text, is dropped on load and refetched; subscriptions and settings are kept.
- **Add-ons Manager:** the add-on description is translated through Firefox's own `_locales` (`en`, `ru`, `de`, Firefox's names) and follows the browser language.
- **Not translated:** platform names, content from the platforms, and developer-only errors.

## Theming and accessibility

- `--ytf-*` custom properties are defined for light and dark (`prefers-color-scheme`); `color-scheme: light dark` covers form controls.
- The tabs follow the WAI-ARIA tablist pattern (roving tabindex; arrow, Home and End keys).
- Status regions use `role="status"` / `aria-live`.

## Packaging boundary

`web-ext-config.mjs` sets `sourceDir: "build"` and `artifactsDir: "dist"`, so the zip contains only compiled JavaScript and static assets: no `.ts`, tests, docs or tooling. AMO reviewers need the TypeScript sources submitted alongside, since the shipped code is generated.
