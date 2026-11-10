import { LocalizedError } from "./errors.js";
import type { MessageKey } from "./i18n/index.js";

/** Parses XML and throws the `errorId` message when the document is malformed. */
export function parseXml(text: string, errorId: MessageKey): Document {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new LocalizedError(errorId);
  }
  return document;
}

/** Returns the trimmed text of the first non-empty element matching any of `names`. */
export function firstText(node: Element | Document, names: readonly string[]): string {
  for (const name of names) {
    const value = node.getElementsByTagName(name)[0]?.textContent.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

/** Returns the trimmed `attribute` of the first element matching any of `names` that has it. */
export function firstAttribute(node: Element, names: readonly string[], attribute: string): string {
  for (const name of names) {
    for (const element of Array.from(node.getElementsByTagName(name))) {
      const value = element.getAttribute(attribute)?.trim();
      if (value) {
        return value;
      }
    }
  }
  return "";
}
