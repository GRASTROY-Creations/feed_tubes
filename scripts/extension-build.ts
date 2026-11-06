import { spawn, type SpawnOptions } from "node:child_process";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_DIR = join(PROJECT_ROOT, "src");
export const BUILD_DIR = join(PROJECT_ROOT, "build");

/** Files under src/ that tsc does not handle and must be copied verbatim. */
export function isStaticAsset(path: string): boolean {
  return extname(path) !== ".ts";
}

/** Runs a command and resolves when it exits successfully. */
export function run(command: string, args: string[], options: SpawnOptions = {}): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", cwd: PROJECT_ROOT, ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${String(code)}.`));
      }
    });
  });
}

/** Spawns `bun x <tool>` through the current Bun executable. */
export function bunx(tool: string, args: string[], options: SpawnOptions = {}): Promise<void> {
  return run(process.execPath, ["x", tool, ...args], options);
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

export async function copyAsset(sourcePath: string): Promise<void> {
  const target = join(BUILD_DIR, relative(SOURCE_DIR, sourcePath));
  await mkdir(dirname(target), { recursive: true });
  await cp(sourcePath, target);
}

export async function copyStaticAssets(): Promise<void> {
  const files = await listFiles(SOURCE_DIR);
  await Promise.all(files.filter(isStaticAsset).map(copyAsset));
}

export async function cleanBuild(): Promise<void> {
  await rm(BUILD_DIR, { recursive: true, force: true });
}

export function compile(extraArgs: string[] = []): Promise<void> {
  return bunx("tsc", ["-p", "tsconfig.build.json", ...extraArgs]);
}

/** Produces a loadable extension in build/. */
export async function buildExtension(): Promise<void> {
  await cleanBuild();
  await compile();
  await copyStaticAssets();
}
