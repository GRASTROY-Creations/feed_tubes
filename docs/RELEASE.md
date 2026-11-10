# Building, Signing, and Shipping

This guide covers three ways to get FeedTubes into a browser, from most to least official:

| Goal                                             | Signed? | Works in Firefox release | Section                                                               |
| ------------------------------------------------ | ------- | ------------------------ | --------------------------------------------------------------------- |
| Public listing on addons.mozilla.org (AMO)       | Yes     | Yes                      | [Public release on AMO](#public-release-on-amo-listed)                |
| Private install from a file, nobody else sees it | Yes     | Yes                      | [Private signed build](#private-signed-build-unlisted)                |
| Private install from a file, no Mozilla account  | No      | No                       | [Unsigned build for local install](#unsigned-build-for-local-install) |

For day-to-day development use `bun run dev` instead (see [DEVELOPMENT.md](DEVELOPMENT.md)); it installs a temporary add-on that disappears on restart.

## Background

- **Firefox release and beta only install signed add-ons.** Mozilla signs them through AMO, either for public listing or "unlisted" (self-distribution). The signature check cannot be turned off in those builds.
- **Firefox Developer Edition, Nightly, ESR, and LibreWolf** can install unsigned add-ons once `xpinstall.signatures.required` is set to `false`.
- **What gets shipped:** `bun run build` compiles `src/` (TypeScript) into `build/` and zips it into `dist/feedtubes-<version>.zip`. That zip is the package. A signed package is an `.xpi`, which is a zip with Mozilla's signature added.
- **Source code for review:** AMO requires the original source with build instructions for any add-on whose shipped code is generated, which includes code compiled from TypeScript. The sections below create that archive.

## One-time setup

### 1. Choose a permanent extension ID

`src/manifest.json` still uses the placeholder `feedtubes@example.com`.

- The ID identifies the add-on forever: updates, stored data, and permissions are tied to it.
- Pick it before the first signed upload and never change it afterwards.
- Use an address-like ID on a domain you control (for example `feedtubes@grastroy.example`), or a UUID in braces (`{4f6a…}`).

```json
"browser_specific_settings": {
  "gecko": {
    "id": "feedtubes@your-domain.example",
    "strict_min_version": "159.0",
    "data_collection_permissions": { "required": ["none"] }
  }
}
```

`data_collection_permissions` is required for new AMO submissions and is already set. Update it if FeedTubes ever sends data anywhere other than the platforms the user configures.

### 2. Get AMO API credentials

1. Sign in at [addons.mozilla.org](https://addons.mozilla.org/) with a Mozilla account.
2. Open **Developer Hub → Manage API Keys** (`https://addons.mozilla.org/developers/addon/api/key/`) and generate credentials.
3. Keep the **JWT issuer** (API key) and **JWT secret**. They are passwords: never commit them, paste them into issues, or put them in `package.json`.

Provide them through environment variables. `web-ext` reads `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` automatically.

PowerShell (current window only):

```powershell
$env:WEB_EXT_API_KEY = "user:12345678:123"
$env:WEB_EXT_API_SECRET = "<secret>"
```

Bash:

```bash
export WEB_EXT_API_KEY="user:12345678:123"
export WEB_EXT_API_SECRET="<secret>"
```

## Release checklist (all signed builds)

1. **Bump the version** with `bun run bump:patch`. Use `bump:minor` or `bump:major` for bigger steps, or `bun run bump 1.4.0` for an exact number. It updates `package.json` and `src/manifest.json` together; add `--dry-run` to preview. AMO rejects a version number it has already signed, so every upload needs a higher number, even private ones.
2. **Check everything:**

   ```bash
   bun install
   bun run lint
   bun test
   ```

3. **Build:**

   ```bash
   bun run build
   ```

4. **Inspect the package.** `manifest.json` must be at the root, with only compiled `.js` files and assets: no `.ts`, tests, docs, or `node_modules`.

   ```bash
   unzip -l dist/feedtubes-*.zip
   ```

5. **Create the source archive for reviewers** from the committed state. Commit first so the archive matches the build.

   ```bash
   git archive --format=zip --output=dist/feedtubes-source.zip HEAD
   ```

   `git archive` leaves out everything ignored by git (`node_modules/`, `build/`, `dist/`). The archive contains `docs/RELEASE.md` and `package.json`, which give reviewers the build steps: install Bun 1.4.4, run `bun install`, run `bun run build:ext`, and the result is in `build/`.

6. **Test the built package** in Firefox and LibreWolf (see [TESTING.md](TESTING.md)). You can use the [unsigned install](#unsigned-build-for-local-install) in Developer Edition or LibreWolf for this.

## Private signed build (unlisted)

This is the right choice for installing FeedTubes on your own machines, or handing it to a few people, without publishing it:

- Mozilla signs the package automatically, usually within minutes.
- The add-on does not appear in the public AMO catalogue.
- The signed `.xpi` installs in every Firefox edition, including release.

After the [release checklist](#release-checklist-all-signed-builds):

```bash
bun x web-ext sign --channel=unlisted --upload-source-code=dist/feedtubes-source.zip
```

`web-ext-config.mjs` already points `sign` at `build/` and writes the result to `dist/`. When it finishes, the signed file is `dist/feedtubes-<version>.xpi`; [install it from the file](#installing-from-a-file).

**Updates:** an unlisted add-on does not update itself. Sign the next version the same way and install the new `.xpi` over the old one. Settings and subscriptions are kept, because the extension ID stays the same.

Automatic updates for unlisted builds are possible by hosting the `.xpi` files and an update manifest yourself (`update_url` in the manifest). See Mozilla's [Updating your extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/).

## Public release on AMO (listed)

A listed add-on goes through Mozilla's review (automatic, plus human review when needed). Once approved, anyone can install it from its AMO page, and Firefox updates it automatically.

### First submission

For the very first listed version, AMO needs listing metadata. Create `amo-metadata.json` outside the repository, or keep it uncommitted:

```json
{
  "version": { "license": "MIT" },
  "categories": { "firefox": ["feeds-news-blogging"] },
  "summary": {
    "en-US": "Your video subscriptions (YouTube, PeerTube, Odysee, RSS…) in the Firefox sidebar."
  }
}
```

Then, after the [release checklist](#release-checklist-all-signed-builds):

```bash
bun x web-ext sign --channel=listed --amo-metadata=amo-metadata.json --upload-source-code=dist/feedtubes-source.zip
```

Alternatively, upload the files by hand at **Developer Hub → Submit a New Add-on**:

- `dist/feedtubes-<version>.zip` as the add-on
- `dist/feedtubes-source.zip` when it asks for source code

### Later versions

```bash
bun x web-ext sign --channel=listed --upload-source-code=dist/feedtubes-source.zip
```

A listed submission returns once it has been queued for review. The approved `.xpi` is then published on AMO; you don't distribute a file yourself.

### Listing notes

- Describe what the add-on does with the network: it fetches feeds directly from the platforms and bridges the user configures, and it uses YouTube's internal web API as a fallback when the RSS feed fails.
- Optional host permissions are requested per source at runtime.
- The `identity` permission is used only for the optional "Sign in with Twitch", through Twitch's official OAuth. No Twitch credentials ship with the add-on: each user registers their own Twitch application.
- **Before release:** replace the placeholder extension ID first. The Twitch redirect URL users register (shown in Settings → Instances) depends on that ID, and changes when the ID changes.
- No data is collected (`data_collection_permissions: none`).
- Add screenshots of the feed and settings tabs on the listing page.

## Unsigned build for local install

Use this when you don't want a Mozilla account involved at all, for example on your own machine with Firefox Developer Edition or LibreWolf. **It does not work in Firefox release or beta**, which always reject unsigned add-ons.

### 1. Build the package

```bash
bun install
bun run build
```

This produces `dist/feedtubes-<version>.zip`. Rename it to `.xpi` so the browser's file picker shows it, or pick it with "All files":

```powershell
Copy-Item dist\feedtubes-<version>.zip dist\feedtubes-<version>.xpi
```

```bash
cp dist/feedtubes-<version>.zip dist/feedtubes-<version>.xpi
```

`bun run build` uses the extension ID from `src/manifest.json`. A permanent install needs that ID. Use the [same ID](#1-choose-a-permanent-extension-id) you would sign with, so you can later switch to a signed build without losing data.

### 2. Allow unsigned add-ons (once per browser profile)

1. Open `about:config` and accept the warning.
2. Search for `xpinstall.signatures.required` and set it to `false`.
3. Restart the browser.

This works in Firefox Developer Edition, Nightly, ESR, and LibreWolf. In LibreWolf you can also put it in your `librewolf.overrides.cfg`:

```js
defaultPref("xpinstall.signatures.required", false);
```

The setting lowers protection for every add-on in that profile, not just FeedTubes. Consider a separate browser profile for it.

### 3. Install

Follow [Installing from a file](#installing-from-a-file).

Updating works the same way: build the next version, then install the new file over the old one.

## Installing from a file

Works for signed `.xpi` files in any Firefox edition, and for unsigned ones where they are allowed:

1. Open `about:addons`.
2. Click the gear icon, then **Install Add-on From File…**.
3. Select the `.xpi`. Dragging the file onto an `about:addons` window works too.
4. Confirm the permission prompt.
5. Open the sidebar via **View → Sidebar → FeedTubes**, or with the sidebar button.

To remove it, open `about:addons`, then FeedTubes → **Remove**.

### Install problems

| Message                                                                | Cause and fix                                                                                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "This add-on could not be installed because it appears to be corrupt." | Usually unsigned in a browser that requires signing. Sign it as [unlisted](#private-signed-build-unlisted), or use an edition that allows unsigned add-ons. |
| "…could not be verified for use in Firefox"                            | Same cause: a signature is required.                                                                                                                        |
| "…not compatible with Firefox"                                         | The browser is older than `strict_min_version` (159.0).                                                                                                     |
| AMO: "Version already exists"                                          | Run `bun run bump:patch`, then rebuild.                                                                                                                     |
| AMO: "Duplicate add-on ID found"                                       | Someone else already uses that ID. Pick another one before the first upload.                                                                                |
