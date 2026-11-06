# FeedTubes — Full Execution Plan

- **Status:** Implemented — automated validation passed; manual sidebar visual check and Windows runtime pending
- **Target:** Firefox / LibreWolf 159 and newer
- **Platforms:** Linux and Windows
- **Package manager / task runner:** Bun 1.4.4
- **Extension source:** `src/`
- **Icons:** SVG only
- **Toolchain:** Full lint/format/build toolchain
- **Extension ID:** `feedtubes@example.com`
- **Version:** `0.1.0`

---

## 1. Goal and Scope

Create a clean, minimal Manifest V3 WebExtension for Firefox and LibreWolf 159+ that:

1. Adds a **FeedTubes** entry to the browser sidebar.
2. Opens a sidebar panel showing a simple **Hello World** placeholder.
3. Uses no unnecessary permissions.
4. Works on Linux and Windows.
5. Follows Mozilla WebExtensions, Manifest V3, and Extension Workshop best practices.
6. Keeps all Markdown documentation under `/docs`.
7. Uses Bun for dependency management and task execution.
8. Is structured so the Hello World placeholder can later be replaced with real YouTube feed logic without rewriting the scaffold.

This plan covers the scaffold only. Actual YouTube feed integration is documented as a future roadmap item.

---

## 2. Requirements Traceability

| Requirement                   | Implementation                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Firefox / LibreWolf 159+      | MV3 manifest with `strict_min_version: "159.0"`                                                            |
| Sidebar entry named FeedTubes | `sidebar_action` with `default_title` and `default_panel`                                                  |
| Hello World content           | `src/sidebar/sidebar.html` card with “Hello World”                                                         |
| Linux and Windows             | Relative URL paths, no absolute paths, no symlinks, cross-platform Bun scripts                             |
| Mozilla best practices        | MV3, least privilege, no inline JS, default CSP, `data_collection_permissions: none`                       |
| Markdown docs in `/docs`      | `docs/PLAN.md`, `README.md`, `INSTALL.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `TESTING.md`, `ROADMAP.md` |
| Bun toolchain                 | `bun install`, `bun add -d`, `bun run`, `bun x`, `bun.lock`                                                |

---

## 3. Key Decisions

| Decision                 | Choice                                            | Reason                                                                   |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Extension source layout  | `src/`                                            | Keeps extension package separate from docs, tooling, and build artifacts |
| Icon format              | SVG only                                          | One scalable source; Firefox supports SVG manifest icons                 |
| Package manager          | Bun                                               | Project standard; Bun 1.4.4 is installed                                 |
| Lint/format              | `web-ext lint` + ESLint + Prettier + EditorConfig | Official extension validation plus JS security/style checks              |
| JavaScript security lint | `eslint-plugin-no-unsanitized`                    | Mozilla-maintained rule set for unsafe DOM APIs                          |
| Minimum Firefox version  | `159.0`                                           | Matches the explicit target                                              |
| Data collection          | `required: ["none"]`                              | Accurate for the scaffold and required for new AMO submissions           |
| Sidebar on install       | `open_at_install: true`                           | The sidebar is the extension’s primary feature                           |

---

## 4. Architecture

### 4.1 Runtime model

- **Manifest V3** extension.
- **`sidebar_action`** registers the sidebar panel.
- **No background script** is required for a static Hello World panel.
- **No permissions** are requested. `sidebar_action` does not require a permission.
- **No content scripts** and no host permissions.
- **No remote code**, no inline scripts, and no inline event handlers.
- The sidebar document runs in the extension origin and can use WebExtension APIs if needed later.

### 4.2 Package boundaries

```text
Repository root
├── src/       → packaged extension (manifest, sidebar, icons)
├── docs/      → Markdown documentation only
├── configs    → Bun, ESLint, Prettier, EditorConfig, web-ext
└── dist/      → generated build artifacts (ignored)
```

`web-ext` uses `src/` as its source directory, so documentation and tooling are never included in the built zip.

### 4.3 Security and privacy baseline

- Default MV3 CSP applies (`script-src 'self'`).
- All JavaScript is in external files.
- No `eval`, `new Function`, `innerHTML`, or remote resources.
- No permissions, no host permissions, no telemetry.
- `browser_specific_settings.gecko.data_collection_permissions.required` is `["none"]`.
- Future feed integration must re-evaluate permissions and the data-collection declaration.

### 4.4 Theme handling

- `color-scheme: light dark` on `:root`.
- Light defaults in `:root`.
- Dark overrides in `@media (prefers-color-scheme: dark)`.
- No reliance on Firefox-internal `--in-content-*` variables, which are not guaranteed inside extension pages.
- No external fonts or assets.

### 4.5 Accessibility

- `lang="en"` on the document.
- Semantic `<main>`, `<header>`, and `<section>`.
- Decorative icon uses `alt=""`.
- Single `<h1>` and a subordinate `<h2>`.
- Status region uses `role="status"` and `aria-live="polite"`.
- `:focus-visible` styling is ready for future controls.
- Theme tokens must maintain readable contrast in both schemes.

### 4.6 Cross-platform notes

- WebExtension manifest paths use `/`, which works on Windows as well.
- No absolute filesystem paths in the extension.
- No symlinks in `src/`.
- Bun scripts are cross-platform.
- OS-specific browser binary paths are passed as command arguments, not hardcoded into extension code.
- Windows runtime testing is documented even if only Linux is available locally.

---

## 5. Repository Layout

```text
/mnt/PROJ/DEV/your_tubes_feed/
├── src/
│   ├── manifest.json
│   ├── sidebar/
│   │   ├── sidebar.html
│   │   ├── sidebar.css
│   │   └── sidebar.js
│   └── icons/
│       └── icon.svg
├── docs/
│   ├── PLAN.md
│   ├── README.md
│   ├── INSTALL.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── TESTING.md
│   └── ROADMAP.md
├── package.json
├── bun.lock
├── eslint.config.js
├── .prettierrc.json
├── .prettierignore
├── .editorconfig
├── web-ext-config.mjs
└── .gitignore
```

Existing `docs/PLAN_01.txt`, `docs/PLAN_02.txt`, and `docs/PLAN_03.txt` remain untouched as historical planning records.

---

## 6. Extension Implementation

### 6.1 `src/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "FeedTubes",
  "version": "0.1.0",
  "description": "Your YouTube feeds in the Firefox and LibreWolf sidebar.",
  "icons": {
    "16": "icons/icon.svg",
    "32": "icons/icon.svg",
    "48": "icons/icon.svg",
    "96": "icons/icon.svg",
    "128": "icons/icon.svg"
  },
  "sidebar_action": {
    "default_title": "FeedTubes",
    "default_panel": "sidebar/sidebar.html",
    "default_icon": "icons/icon.svg",
    "open_at_install": true
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "feedtubes@example.com",
      "strict_min_version": "159.0",
      "data_collection_permissions": {
        "required": ["none"]
      }
    }
  }
}
```

Notes:

- `strict_min_version: "159.0"` matches the requirement.
- `data_collection_permissions` is supported from Firefox 140+, so 159 is valid.
- `open_at_install` defaults to `true`; it is explicit here for clarity.
- The extension ID is a placeholder and must be replaced before AMO signing.
- No `permissions`, `host_permissions`, `background`, or `content_security_policy` keys are needed.

### 6.2 `src/sidebar/sidebar.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FeedTubes</title>
    <link rel="stylesheet" href="sidebar.css" />
    <script src="sidebar.js" defer></script>
  </head>
  <body>
    <main class="sidebar" aria-labelledby="sidebar-title">
      <header class="sidebar__header">
        <img class="sidebar__logo" src="../icons/icon.svg" alt="" width="24" height="24" />
        <h1 id="sidebar-title" class="sidebar__title">FeedTubes</h1>
      </header>

      <section class="card" aria-labelledby="hello-title">
        <h2 id="hello-title" class="card__title">Hello World</h2>
        <p class="card__text">FeedTubes is loaded and ready for your YouTube feed.</p>
      </section>

      <p id="status" class="status" role="status" aria-live="polite"></p>
    </main>
  </body>
</html>
```

### 6.3 `src/sidebar/sidebar.css`

```css
:root {
  color-scheme: light dark;

  --ytf-bg: #ffffff;
  --ytf-surface: #f0f0f4;
  --ytf-text: #15141a;
  --ytf-muted: #5b5b66;
  --ytf-border: rgb(0 0 0 / 12%);
  --ytf-accent: #ff0000;
  --ytf-radius: 8px;
  --ytf-space: 16px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ytf-bg: #1c1b22;
    --ytf-surface: #2b2a33;
    --ytf-text: #f9f9fb;
    --ytf-muted: #bfbfc9;
    --ytf-border: rgb(255 255 255 / 12%);
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
  background: var(--ytf-bg);
  color: var(--ytf-text);
  font:
    14px/1.45 system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--ytf-space);
  padding: var(--ytf-space);
}

.sidebar__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ytf-border);
}

.sidebar__logo {
  flex: none;
  width: 24px;
  height: 24px;
}

.sidebar__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.card {
  padding: 14px;
  background: var(--ytf-surface);
  border: 1px solid var(--ytf-border);
  border-radius: var(--ytf-radius);
}

.card__title {
  margin: 0 0 6px;
  color: var(--ytf-accent);
  font-size: 0.95rem;
}

.card__text {
  margin: 0;
  color: var(--ytf-muted);
}

.status:empty {
  display: none;
}

:focus-visible {
  outline: 2px solid var(--ytf-accent);
  outline-offset: 2px;
}
```

### 6.4 `src/sidebar/sidebar.js`

```js
"use strict";

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const status = document.getElementById("status");

    if (status) {
      status.textContent = "Sidebar ready.";
    }

    console.debug("FeedTubes sidebar initialized.");
  },
  { once: true }
);
```

Notes:

- The script is deferred, so it executes before `DOMContentLoaded`.
- No network calls, storage, or permissions.
- `console.debug` is intentionally minimal for the scaffold; remove or gate it later if desired.
- Future feed code should use `textContent` and DOM APIs, never unsanitized HTML.

### 6.5 `src/icons/icon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect width="48" height="48" rx="10" fill="#ff0000" />
  <path d="M19 14v20l15-10z" fill="#ffffff" />
</svg>
```

Notes:

- Plain SVG with `xmlns` and `viewBox`.
- Square aspect ratio.
- Red background and white play mark remain visible in light and dark themes.
- For a future public AMO listing, export PNG/JPEG listing images from this SVG.

---

## 7. Bun Toolchain

### 7.1 `package.json`

```json
{
  "name": "feedtubes",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.4.4",
  "scripts": {
    "lint": "bun run lint:webext && bun run lint:js && bun run format:check",
    "lint:webext": "web-ext lint",
    "lint:js": "eslint src",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "start": "web-ext run",
    "start:librewolf": "bun run scripts/run-librewolf.mjs",
    "build": "web-ext build"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.14.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-no-unsanitized": "^4.1.5",
    "globals": "^17.14.0",
    "prettier": "^3.9.10",
    "web-ext": "^10.8.0"
  }
}
```

Notes:

- `bun add -d` will update these ranges to current stable versions and write `bun.lock`.
- `web-ext` is a Node-based CLI. Bun 1.4.4 runs the project scripts; Node 24 is available as a compatibility runtime if a specific `web-ext` invocation requires it.
- No npm commands or `package-lock.json` are used.

### 7.2 Bun commands

```bash
# Install dependencies from package.json
bun install

# Add/update development dependencies
bun add -d web-ext eslint @eslint/js eslint-config-prettier \
  eslint-plugin-no-unsanitized globals prettier

# Run checks
bun run lint
bun run lint:webext
bun run lint:js
bun run format:check

# Format
bun run format

# Run in Firefox (default discovery)
bun run start

# Run in LibreWolf on this Linux machine
bun run start:librewolf

# Run in Firefox on this Linux machine
bun run start -- --firefox=/usr/sbin/firefox

# Build the zip into dist/
bun run build

# One-off commands without a package script
bun x web-ext lint
bun x prettier --check .
```

Windows examples:

```powershell
bun run start:librewolf
bun run start -- --firefox="C:\Program Files\Mozilla Firefox\firefox.exe"
```

Set `LIBREWOLF_BIN` if LibreWolf is installed outside the default Windows path.

### 7.3 `eslint.config.js`

```js
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        browser: "readonly",
      },
    },
    plugins: {
      "no-unsanitized": noUnsanitized,
    },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
    },
  },
  eslintConfigPrettier,
];
```

Notes:

- `eslint src` limits linting to extension JavaScript.
- `globals.browser` supplies `document`, `console`, and other browser globals.
- `browser` is declared for future WebExtension API use.
- `no-unsanitized` blocks unsafe DOM sinks.
- `eslint-config-prettier` is last so formatting rules do not conflict with Prettier.

### 7.4 `.prettierrc.json`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "endOfLine": "lf"
}
```

### 7.5 `.prettierignore`

```text
node_modules/
dist/
web-ext-artifacts/
bun.lock
package-lock.json
```

### 7.6 `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### 7.7 `web-ext-config.mjs`

```js
export default {
  sourceDir: "src",
  artifactsDir: "dist",
  build: {
    overwriteDest: true,
  },
  lint: {
    warningsAsErrors: false,
  },
};
```

Notes:

- `web-ext` automatically discovers `web-ext-config.mjs` in the current directory.
- `sourceDir: "src"` ensures docs and tooling are not packaged.
- `artifactsDir: "dist"` keeps build output out of the extension source.
- `warningsAsErrors: false` allows non-blocking warnings; the target is still zero errors and, ideally, zero warnings.

### 7.8 `.gitignore`

```text
node_modules/
dist/
web-ext-artifacts/
*.log
.DS_Store
```

`bun.lock` should be committed.

---

## 8. Documentation Deliverables

All Markdown documentation lives under `docs/`.

### 8.1 `docs/PLAN.md`

This document. It is the authoritative execution plan for the scaffold.

### 8.2 `docs/README.md`

- Project overview and current status (Hello World scaffold).
- Target browsers and versions.
- Repository structure.
- Quick start with Bun.
- Links to the other docs.
- Note that YouTube feed functionality is planned, not implemented.

### 8.3 `docs/INSTALL.md`

- Prerequisites: Firefox or LibreWolf 159+, Bun 1.4.4.
- Linux:
  - `bun install`
  - `bun run start:librewolf`
  - Manual `about:debugging#/runtime/this-firefox` loading with `src/manifest.json`.
- Windows:
  - `bun install`
  - `bun run start:librewolf` (set `LIBREWOLF_BIN` if installed outside the default path)
  - Manual loading with `src\manifest.json`.
- How to open the sidebar: **View → Sidebar → FeedTubes**.
- Temporary add-on vs permanent installation.
- Signing and AMO notes.
- LibreWolf unsigned-extension caveat.
- Troubleshooting:
  - Sidebar not listed.
  - Version below 159 rejected.
  - Reloading the temporary add-on.
  - Inspecting the sidebar console.
  - `web-ext` not found or Bun/Node runtime issues.

### 8.4 `docs/ARCHITECTURE.md`

- Manifest V3 rationale.
- `sidebar_action` flow.
- Why no background script or permissions are needed.
- CSP and security model.
- Theme token design.
- Accessibility decisions.
- `src/` packaging boundary.
- Cross-platform path rules.
- Data-collection declaration.

### 8.5 `docs/DEVELOPMENT.md`

- Bun toolchain and scripts.
- ESLint flat config and `no-unsanitized`.
- Prettier and EditorConfig.
- `web-ext` configuration.
- Build output and zip layout.
- Versioning and release checklist.
- How to add future code without breaking the scaffold.

### 8.6 `docs/TESTING.md`

- Automated checks:
  - `bun run lint`
  - `bun run lint:webext`
  - `bun run lint:js`
  - `bun run format:check`
  - `bun run build`
- Manual test matrix:
  - Firefox 159 on Linux.
  - LibreWolf 159 on Linux.
  - Firefox 159 on Windows.
  - LibreWolf 159 on Windows.
- Test cases:
  - Extension loads without errors.
  - Sidebar entry appears.
  - Hello World renders.
  - Icon appears.
  - Light theme is readable.
  - Dark theme is readable.
  - No permissions are requested.
  - Console has no errors.
  - Temporary add-on reload works.
  - Built zip contains `manifest.json` at the root.

### 8.7 `docs/ROADMAP.md`

- Phase 1: Hello World scaffold (this plan).
- Phase 2: choose a feed data source.
  - YouTube RSS feeds (no API key, limited metadata).
  - YouTube Data API v3 (API key/OAuth, quotas, terms).
  - Privacy-focused alternatives (Invidious/Piped) with caveats.
- Phase 3: UI and state.
  - Feed list, refresh, loading, empty, error, settings.
- Phase 4: permissions and privacy.
  - Add `storage` and narrowly scoped host permissions only when needed.
  - Re-evaluate `data_collection_permissions`.
  - Keep data local by default.
- Phase 5: security.
  - Use `textContent`/DOM APIs, never unsanitized HTML.
  - Validate and sanitize feed data.
  - No remote code.
- Phase 6: packaging and signing.
  - Replace placeholder extension ID.
  - Produce PNG/JPEG listing icon for AMO.
  - Sign and distribute.
- Phase 7: testing.
  - Consider Bun's built-in test runner for pure feed/parsing functions.
  - Add mocked feed fixtures.

---

## 9. Implementation Phases

### Phase 1 — Extension scaffold

1. Create `src/manifest.json`.
2. Create `src/sidebar/sidebar.html`.
3. Create `src/sidebar/sidebar.css`.
4. Create `src/sidebar/sidebar.js`.
5. Create `src/icons/icon.svg`.

### Phase 2 — Bun toolchain

1. Create `package.json`.
2. Run `bun add -d web-ext eslint @eslint/js eslint-config-prettier eslint-plugin-no-unsanitized globals prettier`.
3. Create `eslint.config.js`.
4. Create `.prettierrc.json`.
5. Create `.prettierignore`.
6. Create `.editorconfig`.
7. Create `web-ext-config.mjs`.
8. Create `.gitignore`.
9. Confirm `bun.lock` is generated.

### Phase 3 — Documentation

1. Create `docs/PLAN.md` with this plan.
2. Create `docs/README.md`.
3. Create `docs/INSTALL.md`.
4. Create `docs/ARCHITECTURE.md`.
5. Create `docs/DEVELOPMENT.md`.
6. Create `docs/TESTING.md`.
7. Create `docs/ROADMAP.md`.

### Phase 4 — Automated validation

1. `bun run lint`
2. `bun run build`
3. Inspect `dist/` zip contents.
4. Confirm `manifest.json` is at the zip root.
5. Confirm no docs or tooling files are packaged.

### Phase 5 — Manual validation

1. Load in Firefox 159.0.1 via `about:debugging#/runtime/this-firefox`.
2. Load in LibreWolf 159.0-1 via `about:debugging#/runtime/this-firefox`.
3. Verify the sidebar entry and Hello World panel.
4. Verify light and dark themes.
5. Verify no permissions and a clean console.
6. Document Windows validation steps; run them if a Windows environment is available.

### Phase 6 — Handoff

1. Summarize files created.
2. Record validation results.
3. List exact commands for Linux and Windows.
4. Point to `docs/ROADMAP.md` for the next feature phase.

---

## 10. Validation and Test Matrix

### 10.1 Automated

| Check                   | Command                | Pass condition                               |
| ----------------------- | ---------------------- | -------------------------------------------- |
| Manifest/extension lint | `bun run lint:webext`  | 0 errors                                     |
| JavaScript lint         | `bun run lint:js`      | 0 errors                                     |
| Formatting              | `bun run format:check` | All files formatted                          |
| Build                   | `bun run build`        | Zip created in `dist/`                       |
| Zip layout              | `unzip -l dist/*.zip`  | `manifest.json` at root; only `src/` content |
| Manifest JSON           | editor parse           | Valid JSON                                   |

### 10.2 Manual

| Test                  | Firefox 159 Linux | LibreWolf 159 Linux | Firefox 159 Windows | LibreWolf 159 Windows |
| --------------------- | ----------------- | ------------------- | ------------------- | --------------------- |
| Loads without error   | Required          | Required            | Required            | Required              |
| Sidebar entry appears | Required          | Required            | Required            | Required              |
| Hello World renders   | Required          | Required            | Required            | Required              |
| Icon appears          | Required          | Required            | Required            | Required              |
| Light theme readable  | Required          | Required            | Required            | Required              |
| Dark theme readable   | Required          | Required            | Required            | Required              |
| No permissions        | Required          | Required            | Required            | Required              |
| Console clean         | Required          | Required            | Required            | Required              |
| Temporary reload      | Required          | Required            | Required            | Required              |

Windows rows are documented even if they cannot be executed on the current Linux machine.

---

## 11. Acceptance Criteria

- [x] `src/manifest.json` is valid MV3 and targets Firefox/LibreWolf 159+.
- [x] The extension loads without errors in Firefox 159.0.1 and LibreWolf 159.0-1. Firefox and LibreWolf both load via `web-ext run`; LibreWolf uses the project-local `start:librewolf` override to enable its DevTools server.
- [ ] **FeedTubes** appears under **View → Sidebar**. Requires a human-visible browser session.
- [ ] The sidebar opens and displays the Hello World card. Requires a human-visible browser session.
- [ ] The SVG icon appears in the sidebar header and browser UI. Manifest icons are confirmed; the panel header needs a visual check.
- [ ] Light and dark themes are both readable. Headless pixel checks confirm the theme tokens switch, but human visual confirmation is still required.
- [x] No permissions or host permissions are requested.
- [x] `data_collection_permissions` declares `none`.
- [x] `bun run lint` passes.
- [x] `bun run build` produces a clean zip with `manifest.json` at its root.
- [x] All Markdown documentation is under `docs/`.
- [x] The extension contains no absolute paths, symlinks, remote code, or inline scripts.
- [x] Linux commands are verified; Windows commands and manual steps are documented.

Validation date: 2026-11-05. The unchecked items need a human-visible browser session; headless rendering cannot prove the actual sidebar panel, only that the document is non-blank and the theme tokens switch.

---

## 12. Risks and Mitigations

| Risk                                                    | Mitigation                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `strict_min_version: "159.0"` rejects older browsers    | Intentional; document that 159+ is required                                                                            |
| `data_collection_permissions` omitted or wrong          | Include `required: ["none"]`; `web-ext lint` validates it                                                              |
| SVG-only icons and AMO listing requirements             | Document that PNG/JPEG listing images are needed for a public AMO listing; export from `icon.svg` later                |
| `web-ext` is a Node CLI                                 | Bun runs project scripts; Node 24 is available as a compatibility runtime if needed                                    |
| Windows runtime not testable locally                    | Keep paths portable and document a Windows test checklist                                                              |
| `web-ext lint` version warnings for Firefox 159         | Target 0 errors; document any non-blocking version warning if the linter lags                                          |
| Sidebar opens automatically on install                  | `open_at_install: true` is intentional; can be set to `false` later                                                    |
| LibreWolf disables the DevTools remote debugging server | `bun run start:librewolf` uses a project-local `autoadmin.global_config_url` override; `--pre-install` is the fallback |
| Future feed integration expands permissions             | Keep the scaffold permission-free; plan permissions explicitly in `docs/ROADMAP.md`                                    |

---

## 13. Future Roadmap Summary

1. **Feed source evaluation** — RSS vs YouTube Data API vs privacy alternatives.
2. **Minimal feed UI** — list, refresh, loading, empty, error states.
3. **Storage** — add `storage` permission only when needed.
4. **Network access** — add narrowly scoped host permissions only for chosen feed endpoints.
5. **Security** — DOM-safe rendering, no unsanitized HTML, no remote code.
6. **Privacy** — keep data local; update `data_collection_permissions` if transmission is introduced.
7. **Packaging** — real extension ID, AMO listing icon PNG/JPEG, signing.
8. **Testing** — Bun test runner for pure parsing/filtering logic and mocked feed fixtures.

---

## 14. Implementation Result

The scaffold is implemented. Automated validation passed:

- `bun run lint` — 0 errors and 0 warnings; Prettier clean.
- `bun run build` — `dist/feedtubes-0.1.0.zip` with `manifest.json` at the zip root.
- Firefox 159.0.1 — temporary add-on installed via `bun x web-ext run`.
- LibreWolf 159.0-1 — `bun run start:librewolf` connected to the DevTools server and installed the temporary add-on. The project-local `.librewolf-overrides.cfg` works around LibreWolf's `devtools.debugger.remote-enabled=false` autoconfig.
- LibreWolf fallback — `bun run start:librewolf -- --pre-install` also loads the extension without live reload.

Remaining manual checks:

1. Open **View → Sidebar → FeedTubes** in Firefox and LibreWolf and confirm the panel, icon, and both themes visually.
2. Run the Windows test matrix in `docs/TESTING.md`.
3. Proceed to the feed integration phases in `docs/ROADMAP.md`.
