# Architecture

## Overview

FeedTubes is a Manifest V3 WebExtension whose primary surface is a sidebar panel registered with `sidebar_action`.

The current scaffold is intentionally static:

- No background script.
- No content scripts.
- No permissions or host permissions.
- No network requests.
- No storage.
- No remote code.

This keeps the extension easy to review and gives future feed functionality a clean starting point.

## Manifest V3

`src/manifest.json` declares:

- `manifest_version: 3`.
- `sidebar_action` with `default_title`, `default_panel`, `default_icon`, and `open_at_install`.
- SVG icons for 16, 32, 48, 96, and 128 pixel slots.
- `browser_specific_settings.gecko` with:
  - `id: "feedtubes@example.com"` (placeholder).
  - `strict_min_version: "159.0"`.
  - `data_collection_permissions.required: ["none"]`.

`sidebar_action` does **not** require a permission entry. Do not add `sidebarAction` to `permissions`.

`browser_style` is not supported in MV3 and is omitted.

## Sidebar flow

1. The browser reads `sidebar_action` from the manifest.
2. The sidebar entry appears under **View → Sidebar → FeedTubes**.
3. The browser loads `src/sidebar/sidebar.html` in the extension origin.
4. `sidebar.css` applies theme-aware styling.
5. `sidebar.js` runs after parsing, sets a small status message, and logs one debug message.

The panel can later call WebExtension APIs directly. If it needs privileged background work, add a background script and document the new permission model.

## Security model

- Default MV3 content security policy applies.
- All JavaScript is external (`sidebar.js`).
- No inline `<script>`, inline event handlers, `eval`, `new Function`, or remote scripts.
- No unsanitized HTML sinks.
- ESLint uses `eslint-plugin-no-unsanitized` to reject unsafe DOM APIs.
- No permissions or host permissions are requested.
- The extension declares no data collection.

When feed integration begins:

- Prefer `textContent` and DOM construction over HTML strings.
- Treat all feed data as untrusted.
- Add only the narrowest permissions needed.
- Re-evaluate `data_collection_permissions` if any data leaves the browser.

## Theming

The sidebar uses its own `--ytf-*` custom properties:

- Light values are defined on `:root`.
- Dark values override them inside `@media (prefers-color-scheme: dark)`.
- `color-scheme: light dark` lets form controls and scrollbars follow the browser theme.

The extension does not depend on Firefox-internal `--in-content-*` variables, which are not guaranteed inside extension pages.

## Accessibility

- The document declares `lang="en"`.
- The layout uses semantic `<main>`, `<header>`, and `<section>` elements.
- The decorative icon uses `alt=""`.
- There is one `<h1>` and a subordinate `<h2>`.
- The status paragraph uses `role="status"` and `aria-live="polite"`.
- `:focus-visible` styling is defined for future interactive controls.
- Text colors are chosen to remain readable in both light and dark schemes.

## Packaging boundary

`web-ext` is configured with `sourceDir: "src"`, so only the extension source is packaged. Documentation, configuration files, `node_modules`, and `dist` are excluded automatically.

The build artifact goes to `dist/`.

## Cross-platform rules

- Manifest and HTML paths use `/`, which is valid on Windows as well.
- No absolute filesystem paths inside `src/`.
- No symlinks in `src/`.
- Bun scripts are cross-platform.
- Browser binary paths are passed at runtime, not hardcoded into extension code.

## Data collection

The scaffold collects nothing and sends nothing. The manifest therefore declares:

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

This declaration must be updated if future versions transmit data off the device.
