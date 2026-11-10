import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadLocales, type SourceLanguage } from "../src/lib/i18n/index.js";

export const LOCALES_DIR = join(import.meta.dir, "..", "src", "locales");

/** Reads a translation file from the source tree instead of the packaged extension. */
export function readSourceLocale(language: SourceLanguage): Promise<string> {
  return readFile(join(LOCALES_DIR, language, "feedtubes.ftl"), "utf8");
}

await loadLocales(readSourceLocale);
