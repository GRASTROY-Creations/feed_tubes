import { watch } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { hasFirefoxArg, resolveFirefoxBinary } from "./browser-binary.js";
import {
  BUILD_DIR,
  SOURCE_DIR,
  buildExtension,
  bunx,
  compile,
  copyAsset,
  isStaticAsset,
  rewriteVendorImports,
} from "./extension-build.js";

/**
 * Copies a changed static asset into build/.
 * The recursive watcher also reports folders (on Windows, a folder "changes" whenever a file
 * inside it does) and files that were just deleted; neither is something to copy.
 */
async function copyChangedFile(path: string): Promise<void> {
  const stats = await stat(path).catch(() => null);
  if (stats?.isFile()) {
    await copyAsset(path);
  }
}

/**
 * Development loop: one full build, then `tsc --watch` for code and an fs watcher for
 * static assets, while `web-ext run` reloads the extension whenever build/ changes.
 * Extra CLI arguments are forwarded to `web-ext run`.
 */
export async function startDevLoop(webExtArgs: string[]): Promise<void> {
  await buildExtension();

  const watcher = watch(SOURCE_DIR, { recursive: true }, (_event, filename) => {
    if (filename && isStaticAsset(filename)) {
      copyChangedFile(join(SOURCE_DIR, filename)).catch((error: unknown) => {
        console.warn(`Could not copy ${filename}:`, error);
      });
    }
  });

  // `tsc --watch` re-emits bare package imports; point them at build/vendor/ again.
  const buildWatcher = watch(BUILD_DIR, { recursive: true }, (_event, filename) => {
    if (filename && extname(filename) === ".js" && !filename.startsWith("vendor")) {
      rewriteVendorImports(join(BUILD_DIR, filename))
        .then((unresolved) => {
          if (unresolved.length > 0) {
            console.warn(`${filename} imports ${unresolved.join(", ")}, which is not vendored.`);
          }
        })
        .catch(() => {
          // The file was replaced or removed mid-write; the next change event handles it.
        });
    }
  });

  const typescriptWatch = compile(["--watch", "--preserveWatchOutput"]);

  try {
    await Promise.race([typescriptWatch, bunx("web-ext", ["run", ...webExtArgs])]);
  } finally {
    watcher.close();
    buildWatcher.close();
  }
}

function firefoxArgs(forwardedArgs: readonly string[]): string[] | null {
  if (hasFirefoxArg(forwardedArgs)) {
    return [];
  }

  const firefox = resolveFirefoxBinary();
  switch (firefox.kind) {
    case "found":
      console.log(`Using ${firefox.path}`);
      return [`--firefox=${firefox.path}`];
    case "default":
      return [];
    case "missing":
      console.error(
        `${firefox.reason}\nInstall Firefox, set FIREFOX_BIN to its executable, or use \`bun run start:librewolf\`.`
      );
      return null;
  }
}

if (import.meta.main) {
  const forwardedArgs = process.argv.slice(2);
  const browserArgs = firefoxArgs(forwardedArgs);
  if (browserArgs === null) {
    process.exitCode = 1;
  } else {
    await startDevLoop([...browserArgs, ...forwardedArgs]);
  }
}
