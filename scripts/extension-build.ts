import { spawn, type SpawnOptions } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

/**
 * Runtime dependencies shipped with the extension. There is no bundler, so each package's ES
 * module build is copied into build/vendor/, and the bare specifier in the compiled code is
 * rewritten to a relative path the browser can load.
 */
const VENDORED_PACKAGES = [
  {
    specifier: "@fluent/bundle",
    sourceDir: join(PROJECT_ROOT, "node_modules", "@fluent", "bundle", "esm"),
    targetDir: join(BUILD_DIR, "vendor", "fluent-bundle"),
    entry: "index.js",
  },
] as const;

export async function copyVendoredPackages(): Promise<void> {
  await Promise.all(
    VENDORED_PACKAGES.map(({ sourceDir, targetDir }) =>
      cp(sourceDir, targetDir, {
        recursive: true,
        // Only the runtime modules; type declarations and the nested package.json stay out.
        filter: (path) => !path.endsWith(".d.ts") && !path.endsWith("package.json"),
      })
    )
  );
}

/** Specifiers the browser cannot resolve: anything not starting with `.` or `/`. */
const BARE_IMPORT = /\b(from|import)\s*(["'])([^"'\s./][^"'\s]*)\2/g;

function relativeImport(fromFile: string, target: string): string {
  const path = relative(dirname(fromFile), target).replaceAll("\\", "/");
  return path.startsWith(".") ? path : `./${path}`;
}

/**
 * Rewrites vendored package imports in one compiled file and returns the bare specifiers left
 * over, which would fail in the browser. Leaves the file untouched when nothing changes.
 */
export async function rewriteVendorImports(file: string): Promise<string[]> {
  const code = await readFile(file, "utf8");
  const unresolved: string[] = [];
  const rewritten = code.replace(
    BARE_IMPORT,
    (match, keyword: string, quote: string, specifier: string) => {
      const vendored = VENDORED_PACKAGES.find((pkg) => pkg.specifier === specifier);
      if (!vendored) {
        unresolved.push(specifier);
        return match;
      }
      const target = relativeImport(file, join(vendored.targetDir, vendored.entry));
      return `${keyword} ${quote}${target}${quote}`;
    }
  );
  if (rewritten !== code) {
    await writeFile(file, rewritten);
  }
  return unresolved;
}

/** Rewrites every compiled module; fails the build if any import would not load. */
export async function rewriteAllVendorImports(): Promise<void> {
  const vendorDir = join(BUILD_DIR, "vendor");
  const modules = (await listFiles(BUILD_DIR)).filter(
    (file) => extname(file) === ".js" && !file.startsWith(vendorDir)
  );
  const problems = (
    await Promise.all(
      modules.map(async (file) =>
        (await rewriteVendorImports(file)).map(
          (specifier) => `${relative(BUILD_DIR, file)}: "${specifier}"`
        )
      )
    )
  ).flat();
  if (problems.length > 0) {
    throw new Error(
      ["Imports the browser cannot load (add the package to VENDORED_PACKAGES):", ...problems].join(
        "\n"
      )
    );
  }
}

/** Produces a loadable extension in build/. */
export async function buildExtension(): Promise<void> {
  await cleanBuild();
  await compile();
  await copyStaticAssets();
  await copyVendoredPackages();
  await rewriteAllVendorImports();
}
