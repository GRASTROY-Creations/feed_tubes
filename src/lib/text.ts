const HTML_ENTITIES: readonly (readonly [string, string])[] = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&#x27;", "'"],
  // Decode `&amp;` last so `&amp;lt;` stays `&lt;`.
  ["&amp;", "&"],
];

export function decodeHtmlEntities(value: string): string {
  return HTML_ENTITIES.reduce(
    (text, [entity, character]) => text.replaceAll(entity, character),
    value
  );
}

/** `pluralize(1, "source")` → `"1 source"`, `pluralize(2, "source")` → `"2 sources"`. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) ? bytes : 0;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** Truncates titles from feeds so a hostile feed cannot bloat storage. */
export const MAX_TITLE_LENGTH = 500;

export function cleanTitle(value: string): string {
  return value.trim().slice(0, MAX_TITLE_LENGTH);
}
