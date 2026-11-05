# Roadmap

## Phase 1 — Hello World scaffold

- MV3 extension with `sidebar_action`.
- Static sidebar panel.
- Themed layout and SVG icon.
- No permissions.
- Bun toolchain, linting, formatting, and build.

## Phase 2 — Choose a feed source

Evaluate options before adding network code:

1. **YouTube RSS feeds**
   - No API key.
   - Limited metadata.
   - Public channel feeds only.
2. **YouTube Data API v3**
   - Richer metadata.
   - Requires an API key or OAuth.
   - Quotas and terms apply.
3. **Privacy-focused alternatives**
   - Invidious or Piped instances.
   - Availability and reliability vary.
   - Evaluate privacy and terms carefully.

Document the chosen source, endpoint, and failure modes before implementation.

## Phase 3 — Minimal feed UI

- Feed list.
- Refresh control.
- Loading state.
- Empty state.
- Error state.
- Basic settings for feed URLs or channel IDs.
- Accessible keyboard behavior.

## Phase 4 — Permissions and privacy

- Add `storage` only when persistence is needed.
- Add narrowly scoped host permissions only for chosen endpoints.
- Keep data local by default.
- Re-evaluate `data_collection_permissions` after any transmission.
- Document every permission in the manifest and docs.

## Phase 5 — Security

- Treat all feed data as untrusted.
- Use `textContent` and DOM APIs, never unsanitized HTML.
- Validate URLs and channel identifiers.
- Avoid remote code and inline scripts.
- Keep the default MV3 CSP.
- Add tests for parsing and URL handling.

## Phase 6 — Packaging and signing

- Replace the placeholder extension ID.
- Export PNG/JPEG listing images (32×32 and 64×64) for AMO.
- Add a license.
- Sign through AMO or `web-ext sign`.
- Publish release notes.

## Phase 7 — Testing and hardening

- Use Bun’s test runner for pure feed/parsing functions.
- Add mocked feed fixtures.
- Test malformed feeds and network failures.
- Test on Firefox and LibreWolf, Linux and Windows.
- Check light and dark themes, zoom levels, and narrow sidebar widths.

## Long-term ideas

- Multiple feed sources.
- Read/unread state.
- Search and filtering.
- Import/export of feed settings.
- Localization.
- Optional notifications for new videos.
