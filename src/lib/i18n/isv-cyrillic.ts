/**
 * Interslavic Latin → Cyrillic. Interslavic is translated once, in Latin script
 * (`src/locales/isv-Latn/feedtubes.ftl`); the `isv-Cyrl` messages are generated from it, so the
 * two scripts can never drift apart.
 */

/** Multi-letter sequences first, so `lj` becomes `љ` rather than `л` + `ј`. */
const ISV_CYRILLIC: readonly (readonly [string, string])[] = [
  ["dž", "џ"],
  ["Dž", "Џ"],
  ["DŽ", "Џ"],
  ["lj", "љ"],
  ["Lj", "Љ"],
  ["LJ", "Љ"],
  ["nj", "њ"],
  ["Nj", "Њ"],
  ["NJ", "Њ"],
  ["a", "а"],
  ["b", "б"],
  ["c", "ц"],
  ["č", "ч"],
  ["ć", "ћ"],
  ["d", "д"],
  ["đ", "ђ"],
  ["e", "е"],
  ["ě", "є"],
  ["f", "ф"],
  ["g", "г"],
  ["h", "х"],
  ["i", "и"],
  ["j", "ј"],
  ["k", "к"],
  ["l", "л"],
  ["m", "м"],
  ["n", "н"],
  ["o", "о"],
  ["p", "п"],
  ["r", "р"],
  ["s", "с"],
  ["š", "ш"],
  ["t", "т"],
  ["u", "у"],
  ["v", "в"],
  ["y", "ы"],
  ["z", "з"],
  ["ž", "ж"],
  ["A", "А"],
  ["B", "Б"],
  ["C", "Ц"],
  ["Č", "Ч"],
  ["Ć", "Ћ"],
  ["D", "Д"],
  ["Đ", "Ђ"],
  ["E", "Е"],
  ["Ě", "Є"],
  ["F", "Ф"],
  ["G", "Г"],
  ["H", "Х"],
  ["I", "И"],
  ["J", "Ј"],
  ["K", "К"],
  ["L", "Л"],
  ["M", "М"],
  ["N", "Н"],
  ["O", "О"],
  ["P", "П"],
  ["R", "Р"],
  ["S", "С"],
  ["Š", "Ш"],
  ["T", "Т"],
  ["U", "У"],
  ["V", "В"],
  ["Y", "Ы"],
  ["Z", "З"],
  ["Ž", "Ж"],
];

/** Names that stay in Latin script, as on the platforms themselves. */
const PROTECTED_WORDS = new Set([
  "FeedTubes",
  "YouTube",
  "PeerTube",
  "Twitch",
  "Pixabay",
  "RSSHub",
  "FreeTube",
  "NewPipe",
  "Odysee",
  "Rutube",
  "Dailymotion",
  "Bilibili",
  "Rumble",
  "Takeout",
  "Firefox",
  "LibreWolf",
  "OAuth",
  "Client",
  "Website",
  "Integration",
  "Atom",
  "Slug",
  "http",
  "https",
]);

/**
 * Technical abbreviations, written in Latin script in Cyrillic text too. Listed explicitly:
 * an all-caps word such as `EFIRU` ("on air") is ordinary text and must be transliterated.
 */
const ABBREVIATIONS = new Set([
  "API",
  "B",
  "CSV",
  "HTTP",
  "ID",
  "JSON",
  "KB",
  "MB",
  "OPML",
  "RSS",
  "UC",
  "UID",
  "URL",
  "URLs",
  "VK",
  "XML",
]);

/**
 * URLs and words: the units the transliteration looks at.
 * - A dot only belongs to a word when word characters follow (`d.tube`, `goodgame.ru`, `.db`),
 *   so a sentence-final `.` never makes the last word look like a domain.
 * - A hyphen separates words, so the parts of `RSS-mosta` are judged on their own.
 */
const TOKEN = /https?:\/\/\S+|\.?[\p{L}\p{N}_@/]+(?:\.[\p{L}\p{N}_@/]+)*/gu;

function keepsLatin(word: string): boolean {
  return (
    PROTECTED_WORDS.has(word) || ABBREVIATIONS.has(word) || /[./@\d]/.test(word) // URLs, domains, file types, handles, versions
  );
}

function transliterateWord(word: string): string {
  let result = "";
  for (let index = 0; index < word.length;) {
    const match = ISV_CYRILLIC.find(([latin]) => word.startsWith(latin, index));
    if (match) {
      result += match[1];
      index += match[0].length;
    } else {
      result += word.charAt(index);
      index += 1;
    }
  }
  return result;
}

/** Interslavic Latin → Cyrillic for plain text, leaving brand names and URLs untouched. */
export function transliterateIsvCyrillic(text: string): string {
  return text.replace(TOKEN, (word) => (keepsLatin(word) ? word : transliterateWord(word)));
}

/** Transliterates the text of one pattern line, skipping everything inside `{ … }`. */
function transliterateOutsidePlaceables(line: string): string {
  let result = "";
  let text = "";
  let depth = 0;
  const flush = () => {
    result += transliterateIsvCyrillic(text);
    text = "";
  };
  for (const character of line) {
    if (character === "{") {
      flush();
      depth += 1;
      result += character;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      result += character;
    } else if (depth > 0) {
      result += character;
    } else {
      text += character;
    }
  }
  flush();
  return result;
}

const MESSAGE_LINE = /^(-?[a-zA-Z][\w-]*\s*=)(.*)$/;
const VARIANT_LINE = /^(\s+\*?\[[^\]]+\])(.*)$/;
const ATTRIBUTE_LINE = /^(\s+\.[a-zA-Z][\w-]*\s*=)(.*)$/;

/**
 * Converts a Latin Interslavic Fluent file to Cyrillic. Only message text changes: ids,
 * attribute names, variant keys, comments, and everything inside placeables (`{ $name }`,
 * selectors, function calls) stay as written.
 */
export function transliterateFtl(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      if (line.startsWith("#") || line.trim() === "") {
        return line;
      }
      const prefixed =
        MESSAGE_LINE.exec(line) ?? ATTRIBUTE_LINE.exec(line) ?? VARIANT_LINE.exec(line);
      if (prefixed) {
        const [, head = "", text = ""] = prefixed;
        return `${head}${transliterateOutsidePlaceables(text)}`;
      }
      return transliterateOutsidePlaceables(line); // continuation line
    })
    .join("\n");
}
