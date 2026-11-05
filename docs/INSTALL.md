# Installation and Running

## Prerequisites

- **Firefox 159+** or **LibreWolf 159+**.
- **Bun 1.4.4** or newer.
- Node 24 is available on this machine as a compatibility runtime for Node-based tools such as `web-ext`, but all project commands use Bun.

## Install dependencies

From the repository root:

```bash
bun install
```

This reads `package.json`, installs development dependencies, and writes `bun.lock`.

## Run with `web-ext`

`web-ext` launches a temporary browser profile with the extension installed.

### Linux

```bash
# LibreWolf (project-local remote-debugging override)
bun run start:librewolf

# Firefox
bun run start -- --firefox=/usr/sbin/firefox
```

If the browser is on `PATH`, `bun run start` alone may discover it.

### Windows

```powershell
# LibreWolf
bun run start:librewolf

# Firefox
bun run start -- --firefox="C:\Program Files\Mozilla Firefox\firefox.exe"
```

`bun run start:librewolf` defaults to `C:\Program Files\LibreWolf\librewolf.exe` on Windows. If LibreWolf is installed elsewhere, set `LIBREWOLF_BIN`:

```powershell
$env:LIBREWOLF_BIN = "D:\Apps\LibreWolf\librewolf.exe"
bun run start:librewolf
```

Adjust the Firefox path if it is installed elsewhere.

### LibreWolf remote-debugging workaround

LibreWolf's system config at `/usr/lib/librewolf/librewolf.cfg` contains:

```js
pref("devtools.debugger.remote-enabled", false);
```

LibreWolf applies that at startup and overrides the temporary profile that `web-ext` creates. `web-ext` then cannot connect to the DevTools server and reports `ECONNREFUSED`.

`bun run start:librewolf` avoids editing LibreWolf's global configuration. It runs `scripts/run-librewolf.mjs`, which passes:

```text
--pref=autoadmin.global_config_url=file://<project>/.librewolf-overrides.cfg
```

The project-local `.librewolf-overrides.cfg` enables the debugger server for that `web-ext` session.

If the override is not honored, use the no-live-reload fallback:

```bash
bun run start:librewolf -- --pre-install
```

Or load the extension manually with `about:debugging`.

## Load manually as a temporary add-on

Use this when you want to test the built source directly without `web-ext run`.

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `src/manifest.json` (Linux/macOS) or `src\manifest.json` (Windows).
4. Open the sidebar with **View → Sidebar → FeedTubes**.

Temporary add-ons are removed when the browser restarts. Reload them from `about:debugging` after a restart.

## Open the sidebar

Use the browser menu:

**View → Sidebar → FeedTubes**

There is no standard keyboard shortcut for opening an arbitrary sidebar. If you add one later, document it here.

## Permanent installation

A permanent install requires a signed extension:

1. Replace the placeholder ID `feedtubes@example.com` in `src/manifest.json` with the ID assigned by AMO.
2. Build the package with `bun run build`.
3. Sign it through [addons.mozilla.org](https://addons.mozilla.org/) or `web-ext sign` with AMO credentials.
4. Install the signed `.xpi` in Firefox.

LibreWolf may allow unsigned extensions depending on its build configuration. Do not rely on that for distribution; sign the extension for normal Firefox users.

## Verify the build

```bash
bun run build
unzip -l dist/*.zip
```

The zip must contain `manifest.json` at its root and only files from `src/`.

## Troubleshooting

### The sidebar entry does not appear

- Confirm the extension loaded without errors in `about:debugging`.
- Confirm the browser is version 159 or newer.
- Check `src/manifest.json` for valid JSON.
- Reload the temporary add-on after manifest changes.

### The browser rejects the extension

- `strict_min_version` is `159.0`; older browsers are intentionally unsupported.
- Confirm `data_collection_permissions` is present under `browser_specific_settings.gecko`.
- Run `bun run lint:webext` and fix reported errors.

### The panel is blank or unstyled

- Open the sidebar’s own console from `about:debugging` or the browser toolbox.
- Confirm `sidebar/sidebar.html`, `sidebar/sidebar.css`, and `sidebar/sidebar.js` exist in `src/`.
- Check for CSP errors; the scaffold uses no inline scripts or remote resources.

### `web-ext` fails to start

- Run `bun install` first.
- Confirm the browser path passed to `--firefox` is correct.
- On Linux, confirm the browser binary is executable.
- If LibreWolf reports `ECONNREFUSED`, use `bun run start:librewolf`. If that still fails, use `bun run start:librewolf -- --pre-install` or load the extension manually via `about:debugging`.
- If a Node-based tool behaves unexpectedly under Bun, run the same command with Node 24 as a compatibility fallback.
