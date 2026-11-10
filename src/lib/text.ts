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

/** Truncates titles from feeds so a hostile feed cannot bloat storage. */
export const MAX_TITLE_LENGTH = 500;

export function cleanTitle(value: string): string {
  return value.trim().slice(0, MAX_TITLE_LENGTH);
}
