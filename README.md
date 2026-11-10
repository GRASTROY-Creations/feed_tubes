# FeedTubes

**Your video subscriptions from many platforms, in one feed, in the Firefox sidebar.**

FeedTubes is a Firefox and LibreWolf extension. You subscribe to channels on YouTube, PeerTube, Odysee, Twitch and nine more sources, and their newest videos appear together, newest first, in a compact sidebar panel. It works without an account on any of those platforms, without tracking, and without a server in between: the extension talks directly to each platform from your browser.

- **Version:** 0.2.0
- **Browsers:** Firefox 159+ and LibreWolf 159+ (Manifest V3)
- **Platforms:** Linux and Windows
- **Languages:** English (`eng`), Русский (`rus`), Deutsch (`deu`), Medžuslovjansky in Latin (`isv-Latn`) and Cyrillic script (`isv-Cyrl`). Choose under Settings → General; "Automatic" follows Firefox's language, and uses Russian when Firefox's language isn't one of these. Dates, numbers and lists follow the chosen language.
- **License:** MIT

## Why FeedTubes

- **One place for everything you follow:** no switching between sites, apps and accounts.
- **No algorithm:** you see what your channels published, in date order, and nothing else.
- **Private by design:** no data collection, no analytics, no third-party server. Subscriptions and settings stay in your browser.
- **Portable:** import your existing subscriptions from YouTube Takeout, FreeTube, NewPipe or OPML, and export them again at any time.

## Supported platforms

| Platform    | How videos are read                                         | Needs                                 |
| ----------- | ----------------------------------------------------------- | ------------------------------------- |
| YouTube     | Channel RSS feed, with a fallback when YouTube's feed fails | —                                     |
| PeerTube    | Instance API                                                | The instance's address                |
| Odysee      | Channel RSS feed                                            | —                                     |
| Rutube      | Public API                                                  | —                                     |
| Dailymotion | Channel RSS feed                                            | —                                     |
| D.Tube      | Public API                                                  | —                                     |
| Pixabay     | Official API, one contributor's videos                      | Free Pixabay API key                  |
| Twitch      | Official API (videos + live status), or an RSS bridge       | Twitch sign-in, or an RSSHub feed URL |
| goodgame.ru | Public API: one live / last-stream card per channel         | —                                     |
| VK Video    | RSS bridge                                                  | An RSSHub feed URL                    |
| Bilibili    | RSS bridge                                                  | An RSSHub feed URL                    |
| Rumble      | RSS bridge                                                  | An RSSHub feed URL                    |
| RSS / Atom  | Any video feed                                              | The feed URL                          |

"RSS bridge" means a service such as [RSSHub](https://docs.rsshub.app/) that turns a platform's pages into a feed. You can use a public instance or run your own.

## Installation

### From a release file

1. Download the signed `feedtubes-<version>.xpi`.
2. In Firefox, open `about:addons`, click the gear icon and choose **Install Add-on From File…**.
3. Select the `.xpi` and confirm.

Regular Firefox only installs **signed** add-ons. To build and sign one yourself, privately or for publishing on addons.mozilla.org, follow [docs/RELEASE.md](docs/RELEASE.md).

### From source

You need [Bun](https://bun.sh) 1.4.4 or newer.

```bash
bun install
bun run build
```

This produces an unsigned package in `dist/`. Firefox Developer Edition, Nightly, ESR and LibreWolf can install it from a file once `xpinstall.signatures.required` is set to `false` in `about:config`. [docs/RELEASE.md](docs/RELEASE.md#unsigned-build-for-local-install) has the details.

To try it without installing anything permanently:

```bash
bun run dev
```

This opens a temporary Firefox profile with the extension loaded and reloads it on every change. See [docs/INSTALL.md](docs/INSTALL.md) for LibreWolf and troubleshooting.

## How to use

1. **Open the sidebar** with **View → Sidebar → FeedTubes**. On first install it opens by itself.
2. **Add channels** under **Settings → Subscriptions**: pick the platform and enter a channel name, handle or URL. For example `@UniversalAmbients`, `https://www.youtube.com/@UniversalAmbients/videos` or `https://d.tube/channel/styles`. The **Alias** field optionally sets the name shown in the feed.
   - **Or import a file** under **Settings → Import / Export**: FeedTubes CSV or JSON, YouTube Takeout or FreeTube CSV, FreeTube `.db`, NewPipe JSON, or OPML.
3. **Grant access** when asked. FeedTubes requests permission per website, only for the platforms you actually use.
4. **Read the feed** on the **Feed** tab:
   - Filter by platform or channel.
   - Click a card to open the video in a new tab.
   - **Load more** shows the next 30 videos.
   - **Fetch** checks for new videos now. Each channel is fetched at most once every 5 minutes (Pixabay: once a day), and the feed also refreshes in the background on the schedule set under **Settings → General**.

**Optional setup** under **Settings → Instances**:

- **PeerTube instances and RSS bridges** you use often, so the subscription form can offer them.
- **Pixabay API key**, free from pixabay.com.
- **Twitch Client ID and sign-in**, to read Twitch through its official API. You register a free app at dev.twitch.tv; the steps are shown in Settings.

Keys and sign-ins are stored only in your browser and are never included in exports.

To try every platform at once, import [tests/manual/feedtubes-all-platforms.json](tests/manual/feedtubes-all-platforms.json), which has one example channel per platform.

## Privacy

- **No data collection:** FeedTubes collects nothing and runs no analytics. The manifest declares `data_collection_permissions: none`.
- **Direct requests only:** feed requests go straight from your browser to the platforms and bridges you configure, without cookies.
- **Local storage:** subscriptions, settings and the feed cache live in your browser's extension storage. **Reset all data** under Settings → General removes them.

## Documentation

| Document                                     | Contents                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [docs/INSTALL.md](docs/INSTALL.md)           | Running, loading, and troubleshooting                             |
| [docs/RELEASE.md](docs/RELEASE.md)           | Building, signing (private or public), and installing from a file |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code layout, platform adapters, message protocol, security        |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)   | Toolchain, scripts, linting, and versioning                       |
| [docs/TESTING.md](docs/TESTING.md)           | Automated checks and the manual test matrix                       |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Planned work                                                      |

### For developers

The extension is written in strict TypeScript and compiled to `build/` with `tsc`. Interface text is translated with [Project Fluent](https://projectfluent.org/); the files are in `src/locales/`.

```bash
bun run lint        # version check, typecheck, ESLint, Prettier, web-ext lint
bun test            # unit tests
bun run bump:patch  # bump the version in package.json and the manifest together
```

## Author

**GRASTROY Creations**

## License

[MIT](LICENSE) © 2026 GRASTROY Creations
