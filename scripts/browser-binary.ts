import { existsSync } from "node:fs";
import { join } from "node:path";

const FIREFOX_BINARY_FLAGS = ["-f", "--firefox", "--firefox-binary"];

/** True when the user already chose a browser binary on the `web-ext run` command line. */
export function hasFirefoxArg(args: readonly string[]): boolean {
  return args.some(
    (arg) =>
      FIREFOX_BINARY_FLAGS.includes(arg) ||
      arg.startsWith("--firefox=") ||
      arg.startsWith("--firefox-binary=")
  );
}

export function findFirstExisting(paths: readonly string[]): string | null {
  return paths.find((path) => existsSync(path)) ?? null;
}

/** Install folders of Firefox flavours web-ext can drive, in order of preference. */
const FIREFOX_FLAVOURS = ["Mozilla Firefox", "Firefox Developer Edition", "Firefox Nightly"];
const MAC_APPS = ["Firefox", "Firefox Developer Edition", "Firefox Nightly"];

function windowsCandidates(): string[] {
  const roots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
  ].filter((root): root is string => Boolean(root));

  return FIREFOX_FLAVOURS.flatMap((flavour) =>
    roots.map((root) => join(root, flavour, "firefox.exe"))
  );
}

function macCandidates(): string[] {
  return MAC_APPS.map((app) => `/Applications/${app}.app/Contents/MacOS/firefox`);
}

export type FirefoxResolution =
  { kind: "found"; path: string } | { kind: "default" } | { kind: "missing"; reason: string };

/**
 * Picks the Firefox binary for `web-ext run`.
 * web-ext itself only looks for the release build at its default install path, which fails
 * when only Developer Edition or Nightly is installed.
 */
export function resolveFirefoxBinary(): FirefoxResolution {
  const override = process.env.FIREFOX_BIN;
  if (override) {
    return existsSync(override)
      ? { kind: "found", path: override }
      : { kind: "missing", reason: `FIREFOX_BIN points to a missing file: ${override}` };
  }

  let candidates: string[];
  if (process.platform === "win32") {
    candidates = windowsCandidates();
  } else if (process.platform === "darwin") {
    candidates = macCandidates();
  } else {
    // On Linux, web-ext finds `firefox` on PATH.
    return { kind: "default" };
  }

  const path = findFirstExisting(candidates);
  return path
    ? { kind: "found", path }
    : {
        kind: "missing",
        reason: "No Firefox, Firefox Developer Edition, or Nightly install found.",
      };
}
