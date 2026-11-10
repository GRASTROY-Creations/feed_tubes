/**
 * Translates static markup. Elements name their message keys in data attributes:
 *
 *   data-i18n="key"              → textContent
 *   data-i18n-placeholder="key"  → placeholder
 *   data-i18n-title="key"        → title
 *   data-i18n-aria-label="key"   → aria-label
 *
 * Only `textContent` and `setAttribute` are used, never HTML strings.
 */
import { currentLocaleTag, hasMessage, t } from "./index.js";

const ATTRIBUTE_TARGETS = [
  ["data-i18n-placeholder", "placeholder"],
  ["data-i18n-title", "title"],
  ["data-i18n-aria-label", "aria-label"],
] as const;

function warnUnknown(key: string | undefined): void {
  console.warn(`FeedTubes: unknown translation key "${String(key)}".`);
}

/** Applies the active language to every marked element under `root`, and to `<html lang>`. */
export function applyTranslations(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n;
    if (key !== undefined && hasMessage(key)) {
      element.textContent = t(key);
    } else {
      warnUnknown(key);
    }
  }

  for (const [dataAttribute, target] of ATTRIBUTE_TARGETS) {
    for (const element of root.querySelectorAll(`[${dataAttribute}]`)) {
      const key = element.getAttribute(dataAttribute) ?? undefined;
      if (key !== undefined && hasMessage(key)) {
        element.setAttribute(target, t(key));
      } else {
        warnUnknown(key);
      }
    }
  }

  document.documentElement.lang = currentLocaleTag();
}
