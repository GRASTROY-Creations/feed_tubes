import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FluentResource } from "@fluent/bundle";
import { CLDR_GAP_PREFIX, KEYS_FILE, renderKeysModule } from "../scripts/i18n-keys.js";
import { LocalizedError, toLocalizedText } from "../src/lib/errors.js";
import {
  applyLanguageSetting,
  normalizeLanguageSetting,
  resolveLanguage,
  setLanguage,
  SOURCE_LANGUAGES,
  t,
  translate,
  transliterateFtl,
  transliterateIsvCyrillic,
} from "../src/lib/i18n/index.js";
import { normalizeState, SCHEMA_VERSION } from "../src/lib/storage.js";
import { formatLastUpdated } from "../src/lib/time.js";
import { readSourceLocale } from "./setup.js";

afterEach(() => {
  // Other test files assert English messages.
  setLanguage("eng");
});

type Pattern = FluentResource["body"][number]["value"];

/** Variable names used anywhere in a Fluent pattern, including selectors and variants. */
function variables(pattern: Pattern): Set<string> {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object" || node === null) {
      return;
    }
    const element = node as { type?: unknown; name?: unknown };
    if (element.type === "var" && typeof element.name === "string") {
      found.add(element.name);
    }
    Object.values(node).forEach(visit);
  };
  visit(pattern);
  return found;
}

/** Message id → its variable names, sorted. */
function messages(source: string): Map<string, string> {
  return new Map(
    new FluentResource(source).body.map((message) => [
      message.id,
      [...variables(message.value)].sort().join(),
    ])
  );
}

const sources = new Map(
  await Promise.all(
    SOURCE_LANGUAGES.map(async (language) => [language, await readSourceLocale(language)] as const)
  )
);
const english = messages(sources.get("eng") ?? "");

describe("Fluent files", () => {
  for (const language of SOURCE_LANGUAGES) {
    const source = sources.get(language) ?? "";

    it(`${language} parses without errors`, () => {
      // Fluent skips malformed entries silently; every `id =` line must become a message.
      const declared = source.match(/^[a-zA-Z][\w-]*\s*=/gm) ?? [];
      expect(new FluentResource(source).body).toHaveLength(declared.length);
    });

    it(`${language} defines exactly the English messages`, () => {
      const ids = [...messages(source).keys()].filter((id) => !id.startsWith(CLDR_GAP_PREFIX));
      expect(ids.sort()).toEqual([...english.keys()].sort());
    });

    it(`${language} uses the same variables as English`, () => {
      const translated = messages(source);
      const mismatches = [...english].filter(([id, names]) => translated.get(id) !== names);
      expect(mismatches.map(([id]) => id)).toEqual([]);
    });
  }

  it("has formatting messages only for Interslavic, which CLDR has no data for", () => {
    for (const language of SOURCE_LANGUAGES) {
      const gaps = [...messages(sources.get(language) ?? "").keys()].filter((id) =>
        id.startsWith(CLDR_GAP_PREFIX)
      );
      expect(gaps.length > 0).toBe(language === "isv-Latn");
    }
  });

  it("has every message the sidebar markup names", () => {
    const html = readFileSync(new URL("../src/sidebar/sidebar.html", import.meta.url), "utf8");
    const ids = [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(50);
    expect(ids.filter((id) => !english.has(id ?? ""))).toEqual([]);
  });

  it("matches the generated MessageKey type", () => {
    expect(readFileSync(KEYS_FILE, "utf8").replaceAll("\r\n", "\n")).toBe(renderKeysModule());
  });
});

describe("t()", () => {
  it("fills arguments", () => {
    expect(t("transfer-exported", { filename: "a.csv" })).toBe("Exported a.csv.");
  });

  it("chooses English plural forms and formats numbers", () => {
    expect(t("feed-status-failures", { count: 1 })).toBe("1 source could not be refreshed.");
    expect(t("feed-status-failures", { count: 1200 })).toBe(
      "1,200 sources could not be refreshed."
    );
  });

  it("chooses Russian one/few/many forms", () => {
    setLanguage("rus");
    const forms = [1, 3, 5].map((count) => t("refresh-refreshed", { count }));
    expect(new Set(forms).size).toBe(3);
    expect(t("refresh-refreshed", { count: 21 })).toBe(forms[0]?.replace("1", "21") ?? "");
  });

  it("uses the Russian plural pattern for Interslavic", () => {
    setLanguage("isv-Latn");
    const forms = [1, 3, 5].map((count) => t("refresh-refreshed", { count }));
    expect(new Set(forms).size).toBe(3);
  });

  it("writes Interslavic Cyrillic without touching arguments", () => {
    setLanguage("isv-Cyrl");
    const text = t("keys-signed-in-toast", { login: "Universal" });
    expect(text).toContain("Universal");
    // Only the brand and the inserted login stay in Latin script.
    expect(text.replaceAll("Twitch", "").replaceAll("Universal", "")).not.toMatch(/[A-Za-z]/);
  });

  it("labels a never-fetched feed", () => {
    expect(formatLastUpdated(null)).toBe("No Feed");
  });
});

describe("LocalizedText", () => {
  it("is stored untranslated and translated in the language active when shown", () => {
    const stored = toLocalizedText(
      new LocalizedError("pixabay-no-videos", { name: "x" }),
      "error-raw"
    );
    expect(JSON.parse(JSON.stringify(stored))).toEqual({
      id: "pixabay-no-videos",
      args: { name: "x" },
    });
    const inEnglish = translate(stored);
    setLanguage("deu");
    expect(translate(stored)).not.toBe(inEnglish);
    expect(translate(stored)).toContain("x");
  });

  it("translates nested causes and keeps foreign error text as data", () => {
    const error = new LocalizedError("youtube-both-failed", {
      feed: toLocalizedText(new LocalizedError("youtube-empty-videos-tab"), "error-raw"),
      fallback: toLocalizedText(new Error("boom"), "error-raw"),
    });
    expect(error.message).toContain(t("youtube-empty-videos-tab"));
    expect(error.message).toContain("boom");
  });
});

describe("language settings", () => {
  it("follows supported browser languages, including regional variants", () => {
    expect(resolveLanguage("auto", "de-AT")).toBe("deu");
    expect(resolveLanguage("auto", "ru")).toBe("rus");
    expect(resolveLanguage("auto", "en-US")).toBe("eng");
  });

  it("falls back to Russian for other browser languages", () => {
    expect(resolveLanguage("auto", "fr-FR")).toBe("rus");
    expect(resolveLanguage("auto", "")).toBe("rus");
  });

  it("uses an explicit choice as is", () => {
    expect(resolveLanguage("isv-Cyrl", "de")).toBe("isv-Cyrl");
  });

  it("treats invalid stored settings as automatic and maps old two-letter codes", () => {
    // Outside the browser there is no UI language, so "auto" falls back to Russian.
    expect(applyLanguageSetting("klingon")).toBe("rus");
    expect(applyLanguageSetting("de")).toBe("deu");
    expect(normalizeLanguageSetting("en")).toBe("eng");
    expect(normalizeState({ settings: { ui: { language: "ru" } } }).settings.ui.language).toBe(
      "rus"
    );
  });
});

describe("storage schema", () => {
  const subscriptions = [{ platform: "youtube", channelId: "UC1" }];

  it("drops a cache from before locale-independent errors, keeping subscriptions", () => {
    const state = normalizeState({
      schemaVersion: 1,
      subscriptions,
      cache: { a: { error: "Konnte nicht laden" } },
    });
    expect(state.cache).toEqual({});
    expect(state.subscriptions as unknown).toEqual(subscriptions);
  });

  it("keeps a current cache", () => {
    const cache = { a: { fetchedAt: "", items: [], error: { id: "error-raw" }, errorCode: "" } };
    expect(normalizeState({ schemaVersion: SCHEMA_VERSION, cache }).cache as unknown).toEqual(
      cache
    );
  });
});

describe("Interslavic Cyrillic transliteration", () => {
  it("converts letters and digraphs", () => {
    expect(transliterateIsvCyrillic("Nastavjenja")).toBe("Наставјења");
    expect(transliterateIsvCyrillic("ljubov, konj, džungla, lěto, ty")).toBe(
      "љубов, коњ, џунгла, лєто, ты"
    );
  });

  it("keeps brands, URLs, domains, and abbreviations in Latin", () => {
    expect(transliterateIsvCyrillic("Ključ Pixabay iz pixabay.com/api/docs, RSS i URL.")).toBe(
      "Кључ Pixabay из pixabay.com/api/docs, RSS и URL."
    );
  });

  it("treats hyphenated parts, file types, and all-caps words correctly", () => {
    expect(transliterateIsvCyrillic("RSS-mosta i Bilibili-most")).toBe("RSS-моста и Bilibili-мост");
    expect(transliterateIsvCyrillic("FreeTube .db ili OPML")).toBe("FreeTube .db или OPML");
    expect(transliterateIsvCyrillic("V EFIRU")).toBe("В ЕФИРУ");
  });

  it("transliterates the last word of a sentence", () => {
    expect(transliterateIsvCyrillic("Podpiska izbrisana.")).toBe("Подписка избрисана.");
  });

  it("converts only message text in Fluent files", () => {
    const source = [
      "# Komentar ostaje",
      "lenta-status = Lenta { $name } jest gotova",
      "lenta-count =",
      "    { $count ->",
      "        [one] { $count } video",
      "       *[other] { $count } videa",
      "    }",
    ].join("\n");
    expect(transliterateFtl(source)).toBe(
      [
        "# Komentar ostaje",
        "lenta-status = Лента { $name } јест готова",
        "lenta-count =",
        "    { $count ->",
        "        [one] { $count } видео",
        "       *[other] { $count } видеа",
        "    }",
      ].join("\n")
    );
  });
});
