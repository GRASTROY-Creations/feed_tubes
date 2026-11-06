/** Parses XML and throws `errorMessage` when the document is malformed. */
export function parseXml(text: string, errorMessage: string): Document {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error(errorMessage);
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
