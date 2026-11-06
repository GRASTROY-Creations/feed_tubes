# Testing

## Automated checks

Run from the repository root:

```bash
bun run lint
bun test
bun run build
```

Individual checks:

```bash
bun run typecheck
bun run lint:ts
bun run format:check
bun run lint:webext
```

Pass conditions:

| Check          | Command                                                                     | Pass condition                                                  |
| -------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Type check     | `bun run typecheck`                                                         | 0 errors (strict)                                               |
| ESLint         | `bun run lint:ts`                                                           | 0 errors (type-checked rules)                                   |
| Formatting     | `bun run format:check`                                                      | All files formatted                                             |
| Extension lint | `bun run lint:webext`                                                       | 0 errors on the compiled `build/`                               |
| Unit tests     | `bun test`                                                                  | All pass                                                        |
| Build          | `bun run build`                                                             | Zip created in `dist/`                                          |
| Zip layout     | `unzip -l dist/*.zip`                                                       | `manifest.json` at root; compiled `.js` only, no `.ts` or tests |
| Manifest JSON  | editor or `bun -e 'JSON.parse(await Bun.file("src/manifest.json").text())'` | Valid JSON                                                      |

## Manual test matrix

| Test                     | Firefox 159 Linux | LibreWolf 159 Linux | Firefox 159 Windows | LibreWolf 159 Windows |
| ------------------------ | ----------------- | ------------------- | ------------------- | --------------------- |
| Loads without error      | Required          | Required            | Required            | Required              |
| Sidebar entry appears    | Required          | Required            | Required            | Required              |
| Hello World renders      | Required          | Required            | Required            | Required              |
| Icon appears             | Required          | Required            | Required            | Required              |
| Light theme readable     | Required          | Required            | Required            | Required              |
| Dark theme readable      | Required          | Required            | Required            | Required              |
| No permissions requested | Required          | Required            | Required            | Required              |
| Console clean            | Required          | Required            | Required            | Required              |
| Temporary reload works   | Required          | Required            | Required            | Required              |

Windows rows are documented even when a Windows environment is not available.

## Loading for manual tests

1. Run `bun run build:ext` to compile into `build/`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `build/manifest.json` (not `src/`, which holds TypeScript).
5. Open **View → Sidebar → FeedTubes**.

Or run one of these, which build, watch, and reload automatically:

```bash
bun run dev
```

```bash
bun run start:librewolf
```

## Test cases

### Extension loading

- The add-on appears in `about:debugging` without errors.
- No manifest validation errors appear.
- The browser version is 159 or newer.
- `bun run start:librewolf` connects to LibreWolf's DevTools server and installs the temporary add-on without `ECONNREFUSED`.

### Sidebar entry

- **FeedTubes** appears under **View → Sidebar**.
- Selecting it opens the panel.
- The panel title and icon are correct.

### Hello World panel

- The header shows the icon and “FeedTubes”.
- The card shows “Hello World”.
- The supporting text is present.
- The status region reports “Sidebar ready.” after load.

### Theme

- With a light browser theme, text and surfaces are readable.
- With a dark browser theme, text and surfaces are readable.
- No hardcoded light-only backgrounds remain in dark mode.

### Permissions and privacy

- The extension requests no permissions.
- No host permissions are listed.
- `data_collection_permissions` declares `none`.
- No network requests appear in the sidebar console or network panel.

### Console

- No CSP violations.
- No JavaScript errors.
- The only expected log is `FeedTubes sidebar initialized.`

### Build artifact

- `bun run build` succeeds.
- `dist/` contains one zip.
- The zip root contains `manifest.json`.
- The zip contains `sidebar/` and `icons/`.
- The zip does not contain `docs/`, `node_modules/`, `package.json`, or configuration files.

## Results

Record results here after each validation run:

| Date       | Browser                               | OS      | Result      | Notes                                                                                                                                 |
| ---------- | ------------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-05 | Automated (`bun run lint`)            | Linux   | Pass        | `web-ext lint`: 0 errors, 0 notices, 0 warnings; ESLint passed; Prettier reported all matched files formatted.                        |
| 2026-11-05 | Automated (`bun run build`)           | Linux   | Pass        | `dist/feedtubes-0.1.0.zip` created; `manifest.json` at the zip root; only `src/` content packaged.                                    |
| 2026-11-05 | Firefox 159.0.1                       | Linux   | Pass (load) | Temporary add-on installed via `bun x web-ext run --firefox=/usr/sbin/firefox`; sidebar visual check pending.                         |
| 2026-11-05 | LibreWolf 159.0-1                     | Linux   | Pass (load) | Active MV3 add-on confirmed via `--pre-install`; remote debugger port was unavailable; sidebar visual check pending.                  |
| 2026-11-05 | LibreWolf 159.0-1 (`start:librewolf`) | Linux   | Pass (load) | Project-local override enabled the DevTools server; temporary add-on installed; sidebar visual check pending.                         |
| 2026-11-05 | Headless Firefox theme smoke test     | Linux   | Partial     | Page rendered non-blank; red icon/accent present; light and dark tokens switched. Not a substitute for a human-visible sidebar check. |
| 2026-11-05 | Firefox 159                           | Windows | Not run     | No Windows environment available; manual steps documented.                                                                            |
| 2026-11-05 | LibreWolf 159                         | Windows | Not run     | No Windows environment available; manual steps documented.                                                                            |
