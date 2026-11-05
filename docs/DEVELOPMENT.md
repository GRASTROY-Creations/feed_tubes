# Development

## Toolchain

- **Bun 1.4.4** — dependency management and script runner.
- **web-ext** — Mozilla’s extension linting, running, and packaging CLI.
- **ESLint** — JavaScript linting with flat config.
- **eslint-plugin-no-unsanitized** — rejects unsafe DOM sinks.
- **Prettier** — formatting.
- **EditorConfig** — editor-neutral whitespace and encoding rules.

Node 24 is present as a compatibility runtime for Node-based tools, but project commands use Bun.

## Scripts

```bash
bun run lint          # web-ext lint + ESLint + Prettier check
bun run lint:webext   # manifest and extension lint
bun run lint:js       # ESLint on src/
bun run format          # format the repository
bun run format:check    # check formatting without writing
bun run start           # run with web-ext (Firefox)
bun run start:librewolf # run LibreWolf with the project-local debug override
bun run build           # package src/ into dist/
```

Run a single tool directly with Bun:

```bash
bun x web-ext lint
bun x prettier --check .
bun x eslint src
```

## Adding dependencies

```bash
bun add -d <package>
```

Use `-d` for development-only tools. Commit `bun.lock` after dependency changes. Do not create `package-lock.json` or run npm commands.

## ESLint

`eslint.config.js` uses the flat config format:

- `@eslint/js` recommended rules.
- Browser globals plus a read-only `browser` global for future WebExtension APIs.
- `no-unsanitized/method` and `no-unsanitized/property` set to `error`.
- `eslint-config-prettier` last to disable formatting-related rules.

Linting is limited to `src/**/*.js` so configuration files do not inherit browser assumptions.

## Prettier and EditorConfig

Prettier uses:

- 100-character print width.
- 2-space indentation.
- Double quotes.
- Semicolons.
- ES5 trailing commas.
- LF line endings.

EditorConfig enforces UTF-8, LF, final newlines, 2-space indentation, and trailing-whitespace trimming (except Markdown).

## web-ext configuration

`web-ext-config.mjs` sets:

- `sourceDir: "src"`.
- `artifactsDir: "dist"`.
- `build.overwriteDest: true`.
- `lint.warningsAsErrors: false`.

## LibreWolf development

LibreWolf's system `librewolf.cfg` sets `devtools.debugger.remote-enabled` to `false`. That prevents `web-ext` from connecting to the temporary add-on debugger and causes `ECONNREFUSED`.

`bun run start:librewolf` runs `scripts/run-librewolf.mjs`, which points LibreWolf at the project-local `.librewolf-overrides.cfg`:

```text
--pref=autoadmin.global_config_url=file://<project>/.librewolf-overrides.cfg
```

The override enables the DevTools server and disables the connection prompt. It lives outside `src/`, so it is not included in the extension package.

Override the browser path with `LIBREWOLF_BIN`:

```bash
LIBREWOLF_BIN=/path/to/librewolf bun run start:librewolf
```

Windows PowerShell:

```powershell
$env:LIBREWOLF_BIN = "C:\Program Files\LibreWolf\librewolf.exe"
bun run start:librewolf
```

If LibreWolf still refuses the debugger connection, use the no-live-reload fallback:

```bash
bun run start:librewolf -- --pre-install
```

## Build output

```bash
bun run build
```

The zip is written to `dist/`. Verify its layout:

```bash
unzip -l dist/*.zip
```

Expected root entries include `manifest.json`, `sidebar/`, and `icons/`. Documentation and tooling must not appear.

## Release checklist

1. Update `version` in `src/manifest.json` and `package.json`.
2. Replace the placeholder extension ID if publishing.
3. Run `bun run lint`.
4. Run `bun run build`.
5. Inspect the zip.
6. Test in Firefox and LibreWolf on Linux and Windows.
7. Sign with AMO or `web-ext sign`.
8. Publish or distribute the signed package.

## Adding future code

- Keep extension code under `src/`.
- Keep documentation under `docs/`.
- Add permissions only when required and document why.
- Re-check the data-collection declaration after any network or storage change.
- Use DOM APIs and `textContent`; never inject unsanitized HTML.
- Add tests for pure parsing/filtering logic as the feature grows.
