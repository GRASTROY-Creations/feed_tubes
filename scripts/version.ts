/**
 * Keeps the version number in sync across the project.
 *
 *   bun run bump:patch        0.2.0 → 0.2.1
 *   bun run bump:minor        0.2.0 → 0.3.0
 *   bun run bump:major        0.2.0 → 1.0.0
 *   bun run bump 1.4.0        set an exact version
 *   bun run version:check     fail if the files disagree (part of `bun run lint`)
 *
 * Add `--dry-run` to see what would change without writing.
 *
 * The version lives in `package.json` and `src/manifest.json`. The sidebar shows the version
 * from the manifest at runtime, so no other file carries it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_ROOT } from "./extension-build.js";

export const VERSION_FILES = ["package.json", "src/manifest.json"] as const;

export type BumpLevel = "major" | "minor" | "patch";

const BUMP_LEVELS: readonly string[] = ["major", "minor", "patch"];

/** `major.minor.patch` with plain integers, which Firefox accepts as an add-on version. */
const VERSION_PATTERN = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

/** Matches the top-level `"version": "…"` entry, so formatting and key order are kept. */
const VERSION_FIELD = /^(\s*"version"\s*:\s*")([^"]*)(")/m;

export function isValidVersion(value: string): boolean {
  return VERSION_PATTERN.test(value);
}

export function bumpVersion(current: string, level: BumpLevel): string {
  const match = VERSION_PATTERN.exec(current);
  if (!match) {
    throw new Error(`"${current}" is not a major.minor.patch version.`);
  }

  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  switch (level) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

export function readVersionField(text: string, file: string): string {
  const version = VERSION_FIELD.exec(text)?.[2];
  if (version === undefined) {
    throw new Error(`${file} has no "version" field.`);
  }
  return version;
}

export function replaceVersionField(text: string, version: string): string {
  return text.replace(VERSION_FIELD, `$1${version}$3`);
}

async function readVersions(): Promise<Map<string, { text: string; version: string }>> {
  const entries = await Promise.all(
    VERSION_FILES.map(async (file) => {
      const text = await readFile(join(PROJECT_ROOT, file), "utf8");
      return [file, { text, version: readVersionField(text, file) }] as const;
    })
  );
  return new Map(entries);
}

function describe(versions: Map<string, { version: string }>): string {
  return [...versions].map(([file, { version }]) => `  ${file}: ${version}`).join("\n");
}

/** The one version all files share; throws when they disagree. */
function sharedVersion(versions: Map<string, { version: string }>): string {
  const unique = new Set([...versions.values()].map(({ version }) => version));
  const [version] = unique;
  if (unique.size !== 1 || version === undefined) {
    throw new Error(
      `Version numbers disagree:\n${describe(versions)}\nSet one explicitly: bun run bump <version>`
    );
  }
  return version;
}

async function check(): Promise<void> {
  const version = sharedVersion(await readVersions());
  if (!isValidVersion(version)) {
    throw new Error(`Version "${version}" is not a major.minor.patch version.`);
  }
  console.log(`Version ${version} is consistent in ${VERSION_FILES.join(", ")}.`);
}

async function setVersion(target: string, dryRun: boolean): Promise<void> {
  const versions = await readVersions();

  const next = BUMP_LEVELS.includes(target)
    ? bumpVersion(sharedVersion(versions), target as BumpLevel)
    : target;
  if (!isValidVersion(next)) {
    throw new Error(`"${next}" is not a major.minor.patch version, e.g. 1.4.0.`);
  }

  for (const [file, { text, version }] of versions) {
    console.log(`${file}: ${version} → ${next}`);
    if (!dryRun && version !== next) {
      await writeFile(join(PROJECT_ROOT, file), replaceVersionField(text, next));
    }
  }

  if (dryRun) {
    console.log("Dry run: nothing written.");
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [command] = args.filter((arg) => arg !== "--dry-run");

  try {
    if (command === "check") {
      await check();
    } else if (command) {
      await setVersion(command, dryRun);
    } else {
      throw new Error("Usage: bun run bump <major|minor|patch|x.y.z> [--dry-run]");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
