# Development

## Toolchain

- **Bun 1.4.4**: dependency management, script runner, and test runner (`bun test` runs `.ts` directly).
- **TypeScript 6.0**: strict type checking, and compilation of `src/` into `build/`. It is pinned to `~6.0` because `typescript-eslint` does not support TypeScript 7 yet.
- **web-ext**: Mozilla's extension linting, running, and packaging CLI.
- **ESLint + typescript-eslint**: `strictTypeChecked` and `stylisticTypeChecked` rules, flat config in `eslint.config.ts`.
- **eslint-plugin-no-unsanitized**: rejects unsafe DOM sinks.
- **Prettier**: formatting.
- **EditorConfig**: editor-neutral whitespace and encoding rules.

Node 24 is present as a compatibility runtime for Node-based tools, but project commands use Bun.

## Source and build layout

- `src/` holds TypeScript plus static assets (`manifest.json`, HTML, CSS, icons). The browser cannot load it directly.
- `build/` is the unpacked, loadable extension:
  - `scripts/build.ts` runs `tsc -p tsconfig.build.json`, which emits one `.js` per `.ts` module with the same layout.
  - It then copies every non-`.ts` file from `src/`, including the `.ftl` translations.
  - It copies the ES module build of `@fluent/bundle`, the one runtime dependency, into `build/vendor/fluent-bundle/`, and rewrites the `"@fluent/bundle"` import in the compiled files to that path. The build fails if any other package import is left, since the browser cannot resolve it. `bun run dev` repeats the rewrite whenever `tsc --watch` re-emits a file.
- `dist/` holds the packaged zip from `web-ext build`.

Imports inside `.ts` files use `.js` specifiers (`import { x } from "./url.js"`). `tsc` emits them unchanged for the browser, and Bun resolves them to the `.ts` files in tests.

`tsconfig.json` type-checks everything (`src`, `tests`, `scripts`) without emitting. `tsconfig.build.json` extends it and emits only `src/` with the WebExtension types.

## Scripts

```bash
bun run typecheck       # tsc, strict, no emit
bun run lint            # typecheck + ESLint + Prettier check + web-ext lint (on build/)
bun run lint:ts         # ESLint with type-aware rules
bun run lint:webext     # compile, then lint the extension in build/
bun run format          # format the repository
bun run format:check    # check formatting without writing
bun test                # unit tests
bun run build:ext       # compile src/ into build/
bun run dev             # build, then tsc --watch + asset watcher + web-ext run (Firefox)
bun run start           # alias for dev
bun run start:librewolf # dev loop in LibreWolf with the project-local debug override
bun run build           # build:ext, then package build/ into dist/
bun run bump:patch      # bump the version (also bump:minor, bump:major, bump <x.y.z>)
bun run version:check   # fail if package.json and src/manifest.json disagree
bun run i18n:keys       # regenerate src/lib/i18n/keys.ts from the English Fluent file
bun run i18n:check      # fail if keys.ts is out of date (part of lint)
```

Run a single tool directly with Bun:

```bash
bun x tsc -p tsconfig.json
bun x prettier --check .
bun x eslint src
```

## Adding dependencies

```bash
bun add -d <package>
```

Use `-d` for development-only tools. Commit `bun.lock` after dependency changes. Do not create `package-lock.json` or run npm commands.

## ESLint

`eslint.config.ts` (loaded through `jiti`) uses the flat config format:

- `@eslint/js` recommended rules.
- `typescript-eslint` `strictTypeChecked` and `stylisticTypeChecked`, using the project service.
- `consistent-type-imports`, `eqeqeq`, and `prefer-const`.
- `prefer-nullish-coalescing` ignores strings, because `""` deliberately means "missing" in the subscription model.
- `no-unsanitized/method` and `no-unsanitized/property` set to `error`.
- Browser globals for `src/`, Node globals for `tests/`, `scripts/`, and the config itself. The `browser` WebExtension namespace comes from `@types/firefox-webext-browser`.
- `eslint-config-prettier` last, to disable formatting-related rules.

`types/` holds ambient declarations for untyped dev dependencies.

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

`web-ext-config.mjs` is the one JavaScript file left in the repository, because web-ext cannot load a TypeScript config. It sets:

- `sourceDir: "build"`.
- `artifactsDir: "dist"`.
- `build.overwriteDest: true`.
- `lint.warningsAsErrors: false`.

## Choosing the Firefox binary

On its own, `web-ext run` only looks for the Firefox release build at its default install path. It fails with `spawn … firefox.exe ENOENT` when only Developer Edition or Nightly is installed.

`bun run dev` (`scripts/dev.ts` and `scripts/browser-binary.ts`) picks the binary itself:

1. `FIREFOX_BIN`, if set.
2. Otherwise, on Windows and macOS, the first installed of Firefox, then Firefox Developer Edition, then Firefox Nightly.
   - On Windows it looks under `%ProgramFiles%`, `%ProgramFiles(x86)%`, and `%LOCALAPPDATA%`.
3. On Linux, web-ext's own lookup of `firefox` on `PATH`.

An explicit flag always wins:

```bash
bun run dev -- --firefox="C:\Program Files\Firefox Nightly\firefox.exe"
```

Windows PowerShell:

```powershell
$env:FIREFOX_BIN = "C:\Program Files\Firefox Developer Edition\firefox.exe"
bun run dev
```

## LibreWolf development

LibreWolf's system `librewolf.cfg` sets `devtools.debugger.remote-enabled` to `false`. That prevents `web-ext` from connecting to the temporary add-on debugger and causes `ECONNREFUSED`.

`bun run start:librewolf` runs `scripts/run-librewolf.ts`, which starts the dev loop and points LibreWolf at the project-local `.librewolf-overrides.cfg`:

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

Expected root entries include `manifest.json`, `background/`, `lib/`, `sidebar/`, `locales/`, `vendor/`, `_locales/` and `icons/`, all compiled `.js` plus static assets. No `.ts` sources, tests, documentation, or tooling may appear.

## Release checklist

See [RELEASE.md](RELEASE.md). It covers versioning, the source archive AMO reviewers need, unlisted and listed signing, and installing from a file.

## Internationalisation rules

- **Language codes:** languages are named by their ISO 639-3 code (`eng`, `rus`, `deu`, `isv`) in documentation, settings, and translation file and directory names. A language written in more than one script gets its ISO 15924 script code appended: `isv-Latn`, `isv-Cyrl`.
  - **Runtime only:** `Intl` and `<html lang>` need BCP 47 tags, which use the shortest ISO 639 code (`en`, not `eng`). `LANGUAGE_TAGS` in `src/lib/i18n/index.ts` is the one place that converts.
  - **Exception, Firefox naming:** `src/_locales/{en,ru,de}/` and `"default_locale": "en"` in the manifest keep Firefox's own locale names, because Firefox accepts no others there. They only translate the Add-ons Manager description.
- **Formatting:** dates, times, numbers, lists and plural forms are never formatted by hand. They go through CLDR data via `Intl`, in `src/lib/i18n/format.ts`, or through Fluent, which formats numeric arguments with `Intl.NumberFormat` and picks plural variants with `Intl.PluralRules`. Pass numbers to `t()` as numbers. Pass codes and identifiers (HTTP status, video ids) as strings, so they are never digit-grouped.
  - **Exception, Interslavic:** CLDR has no Interslavic data, and `Intl` would silently fall back to English. For `isv` the same values are formatted by the `cldr-*` messages in `src/locales/isv-Latn/feedtubes.ftl`, with Russian plural rules and number formatting.
- **Storage and messages between contexts:** values are locale-independent:
  - timestamps are ISO 8601 strings in UTC (`toISOString()`)
  - numbers are stored as numbers
  - text is stored as a message id with arguments (`LocalizedText`), never as translated text, and translated only when shown
  - currencies, should they ever appear, carry their ISO 4217 code

## Translations

Interface text lives in Fluent files, one per language: `src/locales/<ISO 639-3>/feedtubes.ftl` (see [ARCHITECTURE.md](ARCHITECTURE.md#interface-language)). `eng` is the source.

**Adding or changing a message:**

1. Add it to `src/locales/eng/feedtubes.ftl`. Ids are lowercase with dashes (`feed-empty-title`). Countable text uses a selector: `{ $count -> [one] … *[other] … }`.
2. Run `bun run i18n:keys`. It regenerates `src/lib/i18n/keys.ts`, so `t()` accepts the new id. `bun run lint` fails while the file is out of date.
3. Add the message to `rus`, `deu` and `isv-Latn`. Interslavic is written in Latin only; Cyrillic is generated.
4. Use it as `t("my-message", { name })` in code, or `data-i18n="my-message"` (also `-placeholder`, `-title`, `-aria-label`) in `sidebar.html`.

`tests/i18n.test.ts` checks that every file parses, defines exactly the English messages and uses the same `$variables`.

**Adding a language:**

1. Create `src/locales/<code>/feedtubes.ftl` with every English message.
2. Add the code to `Language`, `SOURCE_LANGUAGES`, `LANGUAGE_TAGS`, `BUNDLE_LOCALES` and `LANGUAGE_OPTIONS` in `src/lib/i18n/index.ts`. If the browser can report it, add it to `BROWSER_LANGUAGES` too.
3. If CLDR has no data for it, add its formatting as `cldr-*` messages and include it in `lacksCldrData()`.
4. If Firefox has that locale, add `src/_locales/<Firefox locale>/messages.json` for the Add-ons Manager description.

The Russian, German and Interslavic texts were drafted for this release; review by native speakers is welcome, Interslavic in particular.

## Adding future code

- Keep extension code under `src/`.
- Keep documentation under `docs/`.
- Add permissions only when required and document why.
- Re-check the data-collection declaration after any network or storage change.
- Use DOM APIs and `textContent`; never inject unsanitized HTML.
- Add tests for pure parsing/filtering logic as the feature grows.
