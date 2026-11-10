/**
 * FeedTubes' interface language, built on Project Fluent. Firefox's `browser.i18n` always
 * follows the browser's language and has no Interslavic, so the language is chosen here
 * instead: Settings → General → Language, stored as `settings.ui.language`.
 *
 * - Messages live in `src/locales/<ISO 639-3>/feedtubes.ftl`; `eng` is the source.
 * - `loadLocales()` reads every file once per extension context. After that, switching the
 *   language and `t()` are synchronous.
 * - Interslavic Cyrillic (`isv-Cyrl`) is generated from the Latin file.
 */
import { FluentBundle, FluentResource, type FluentVariable } from "@fluent/bundle";
import { transliterateFtl } from "./isv-cyrillic.js";
import type { CldrGapKey, MessageKey } from "./keys.js";

export type { CldrGapKey, MessageKey } from "./keys.js";

/** Interface languages: ISO 639-3, plus an ISO 15924 script for languages with several. */
export type Language = "eng" | "rus" | "deu" | "isv-Latn" | "isv-Cyrl";
export type LanguageSetting = "auto" | Language;

/** Languages with their own `.ftl` file. `isv-Cyrl` is derived from `isv-Latn`. */
export type SourceLanguage = Exclude<Language, "isv-Cyrl">;
export const SOURCE_LANGUAGES: readonly SourceLanguage[] = ["eng", "rus", "deu", "isv-Latn"];

/** Used by "Automatic" when the browser's language is none of the supported ones. */
export const FALLBACK_LANGUAGE: Language = "rus";

/** Entries of the Language select, in display order, with their native names. */
export const LANGUAGE_OPTIONS: readonly { value: LanguageSetting; nativeName: string | null }[] = [
  { value: "auto", nativeName: null },
  { value: "eng", nativeName: "English" },
  { value: "rus", nativeName: "Русский" },
  { value: "deu", nativeName: "Deutsch" },
  { value: "isv-Latn", nativeName: "Medžuslovjansky (latinica)" },
  { value: "isv-Cyrl", nativeName: "Меджусловјанскы (кирилица)" },
];

/**
 * BCP 47 tags for `<html lang>` and `Intl`, which use the shortest ISO 639 code (`en`, not
 * `eng`). Used only at runtime; files, settings, and docs use the ISO 639-3 names above.
 */
export const LANGUAGE_TAGS: Readonly<Record<Language, string>> = {
  eng: "en",
  rus: "ru",
  deu: "de",
  "isv-Latn": "isv-Latn",
  "isv-Cyrl": "isv-Cyrl",
};

/**
 * Locales handed to Fluent (plural rules and number formatting). CLDR has no Interslavic data,
 * so `Intl` falls back to Russian, whose one/few/many pattern Interslavic shares.
 */
const BUNDLE_LOCALES: Readonly<Record<Language, readonly string[]>> = {
  eng: ["en"],
  rus: ["ru"],
  deu: ["de"],
  "isv-Latn": ["isv-Latn", "ru"],
  "isv-Cyrl": ["isv-Cyrl", "ru"],
};

/** Stored values from before ISO 639-3 identifiers. */
const LEGACY_LANGUAGES: Readonly<Record<string, Language>> = { en: "eng", ru: "rus", de: "deu" };

/** Browser UI language (ISO 639-1 base, as Firefox reports it) → interface language. */
const BROWSER_LANGUAGES: Readonly<Record<string, Language>> = { en: "eng", ru: "rus", de: "deu" };

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return LANGUAGE_OPTIONS.some((option) => option.value === value);
}

/** A stored `settings.ui.language` value as a valid setting; old `en`/`ru`/`de` are mapped. */
export function normalizeLanguageSetting(value: unknown): LanguageSetting {
  if (isLanguageSetting(value)) {
    return value;
  }
  return (typeof value === "string" && LEGACY_LANGUAGES[value]) || "auto";
}

/**
 * The language to show for a setting. "Automatic" uses the browser's UI language when it is
 * supported (`de-AT` → `deu`), otherwise `FALLBACK_LANGUAGE`.
 */
export function resolveLanguage(setting: LanguageSetting, uiLanguage: string): Language {
  if (setting !== "auto") {
    return setting;
  }
  const base = uiLanguage.toLowerCase().split(/[-_]/)[0] ?? "";
  return BROWSER_LANGUAGES[base] ?? FALLBACK_LANGUAGE;
}

/** Whether CLDR lacks data for `language`, so formatting uses `cldr-*` messages instead. */
export function lacksCldrData(language: Language): boolean {
  return language.startsWith("isv");
}

// --- Loading ----------------------------------------------------------------------

/** Reads the Fluent source of one language. */
export type LocaleReader = (language: SourceLanguage) => Promise<string>;

/** Reads the `.ftl` files packaged with the extension. */
export const readPackagedLocale: LocaleReader = async (language) => {
  const response = await fetch(browser.runtime.getURL(`locales/${language}/feedtubes.ftl`));
  if (!response.ok) {
    throw new Error(`FeedTubes: could not load locales/${language}/feedtubes.ftl.`);
  }
  return response.text();
};

const bundles = new Map<Language, FluentBundle>();

/** Builds a bundle and reports syntax errors, which Fluent otherwise skips silently. */
export function createBundle(language: Language, source: string): FluentBundle {
  const bundle = new FluentBundle([...BUNDLE_LOCALES[language]], { useIsolating: false });
  const errors = bundle.addResource(new FluentResource(source));
  for (const error of errors) {
    console.error(`FeedTubes: ${language} translation error.`, error);
  }
  return bundle;
}

/** Loads every language. Call once per extension context, before producing any text. */
export async function loadLocales(read: LocaleReader = readPackagedLocale): Promise<void> {
  const sources = await Promise.all(SOURCE_LANGUAGES.map(read));
  SOURCE_LANGUAGES.forEach((language, index) => {
    const source = sources[index] ?? "";
    bundles.set(language, createBundle(language, source));
    if (language === "isv-Latn") {
      bundles.set("isv-Cyrl", createBundle("isv-Cyrl", transliterateFtl(source)));
    }
  });
}

// --- Active language --------------------------------------------------------------

// Tests and anything running before `applyLanguageSetting` see English, the source language.
let active: Language = "eng";

/** Firefox's UI language, e.g. `de` or `ru-RU`; `""` outside the extension. */
function browserUiLanguage(): string {
  const runtime = globalThis as { browser?: { i18n?: { getUILanguage?: () => string } } };
  const navigatorLanguage = (globalThis.navigator as Navigator | undefined)?.language;
  return runtime.browser?.i18n?.getUILanguage?.() ?? navigatorLanguage ?? "";
}

/**
 * Activates the language for a stored `settings.ui.language` value (invalid values count as
 * "auto") and returns it.
 */
export function applyLanguageSetting(setting: unknown): Language {
  const language = resolveLanguage(normalizeLanguageSetting(setting), browserUiLanguage());
  setLanguage(language);
  return language;
}

export function setLanguage(language: Language): void {
  active = language;
}

export function currentLanguage(): Language {
  return active;
}

/** BCP 47 tag of the active language, for `Intl` and `<html lang>`. */
export function currentLocaleTag(): string {
  return LANGUAGE_TAGS[active];
}

// --- Messages ---------------------------------------------------------------------

/** Message arguments. Pass numbers as numbers: Fluent formats them for the language. */
export type MessageArgs = Readonly<Record<string, FluentVariable>>;

/**
 * Text that is stored or sent between extension contexts as a message id plus arguments, and
 * translated only when shown. Arguments may be nested texts, e.g. an error's cause.
 */
export interface LocalizedText {
  readonly id: MessageKey;
  readonly args?: Readonly<Record<string, string | number | LocalizedText>>;
}

export function isLocalizedText(value: unknown): value is LocalizedText {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function format(id: MessageKey | CldrGapKey, args: MessageArgs): string {
  const bundle = bundles.get(active);
  const message = bundle?.getMessage(id);
  if (!bundle || !message?.value) {
    console.warn(`FeedTubes: no "${id}" message for ${active}.`);
    return id;
  }
  const errors: Error[] = [];
  const text = bundle.formatPattern(message.value, args, errors);
  for (const error of errors) {
    console.warn(`FeedTubes: "${id}" (${active}):`, error.message);
  }
  return text;
}

/** The text of message `id` in the active language. */
export function t(id: MessageKey, args: MessageArgs = {}): string {
  return format(id, args);
}

/** A `cldr-*` message, for formatting in languages without CLDR data (see `format.ts`). */
export function tCldrGap(id: CldrGapKey, args: MessageArgs = {}): string {
  return format(id, args);
}

/** Translates a stored `LocalizedText`, including nested arguments. */
export function translate(text: LocalizedText): string {
  const args: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(text.args ?? {})) {
    args[name] = isLocalizedText(value) ? translate(value) : value;
  }
  return t(text.id, args);
}

/** Whether the active language has a message with this id (for ids read from markup). */
export function hasMessage(id: string): id is MessageKey {
  return bundles.get(active)?.hasMessage(id) ?? false;
}

export { transliterateFtl, transliterateIsvCyrillic } from "./isv-cyrillic.js";
