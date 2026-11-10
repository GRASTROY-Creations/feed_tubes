# FeedTubes

FeedTubes is a minimal Firefox/LibreWolf sidebar extension that will eventually show YouTube feeds in the browser sidebar.

## Current status

**Hello World scaffold — implemented and automatically validated.** The extension loads a static sidebar panel with a Hello World card, a themed layout, and an SVG icon. Feed fetching, storage, and settings are not implemented yet. A manual sidebar visual check and Windows runtime testing are still pending.

- Target browsers: **Firefox 159+** and **LibreWolf 159+**
- Manifest: **Manifest V3**
- Platforms: **Linux** and **Windows**
- Permissions: **none**
- Data collection: **none**
- Package manager / task runner: **Bun 1.4.4**

## Repository layout

```text
.
├── src/                  # packaged extension
│   ├── manifest.json
│   ├── sidebar/
│   │   ├── sidebar.html
│   │   ├── sidebar.css
│   │   └── sidebar.js
│   └── icons/
│       └── icon.svg
├── docs/                 # all Markdown documentation
├── scripts/
│   └── run-librewolf.mjs # LibreWolf development launcher
├── package.json          # Bun scripts and dev dependencies
├── bun.lock              # Bun lockfile
├── .librewolf-overrides.cfg # project-local LibreWolf debug override
├── eslint.config.js
├── .prettierrc.json
├── .prettierignore
├── .editorconfig
├── web-ext-config.mjs
└── .gitignore
```

## Quick start

```bash
bun install
bun run lint
bun run build
```

Run the extension in a browser:

```bash
# Firefox discovered by web-ext
bun run start

# LibreWolf with the project-local remote-debugging override
bun run start:librewolf

# Firefox on this Linux machine
bun run start -- --firefox=/usr/sbin/firefox
```

On Windows:

```powershell
bun run start:librewolf
bun run start -- --firefox="C:\Program Files\Mozilla Firefox\firefox.exe"
```

Set `LIBREWOLF_BIN` if LibreWolf is installed outside the default path.

Open the panel with **View → Sidebar → FeedTubes**.

## Documentation

- [PLAN.md](PLAN.md) — full execution plan, architecture decisions, and acceptance criteria.
- [INSTALL.md](INSTALL.md) — loading, running, and troubleshooting.
- [RELEASE.md](RELEASE.md) — building, signing (listed and unlisted), shipping, and installing from a file.
- [ARCHITECTURE.md](ARCHITECTURE.md) — extension architecture, security, theming, and accessibility.
- [DEVELOPMENT.md](DEVELOPMENT.md) — Bun toolchain, scripts, linting, formatting, and releases.
- [TESTING.md](TESTING.md) — automated checks and manual browser test matrix.
- [ROADMAP.md](ROADMAP.md) — planned feed integration and future work.

## License

No license has been selected yet. Add one before distributing the extension.
