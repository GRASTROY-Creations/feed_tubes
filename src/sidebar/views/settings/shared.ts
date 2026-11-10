import { createEl, createOption } from "../../../lib/dom.js";
import { PLATFORM_IDS, platformLabel } from "../../../lib/platforms/registry.js";
import { ALL } from "../../../lib/types.js";

/** One block of the settings panel. */
export interface SettingsSection {
  /** Re-renders from stored state; omitted by sections that only hold user input. */
  render?(): void;
  /** Returns the section's form to its initial state. */
  reset?(): void;
}

export function submitButtonOf(form: HTMLFormElement): HTMLButtonElement {
  const button = form.querySelector('button[type="submit"]');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Form #${form.id} has no submit button.`);
  }
  return button;
}

export function fillPlatformOptions(
  select: HTMLSelectElement,
  { includeAll = false }: { includeAll?: boolean } = {}
): void {
  select.replaceChildren(
    ...(includeAll ? [createOption(ALL, "All platforms")] : []),
    ...PLATFORM_IDS.map((platform) => createOption(platform, platformLabel(platform)))
  );
}

export function hintParagraph(text: string): HTMLParagraphElement {
  return createEl("p", { className: "hint", text });
}

export interface ListRowOptions {
  title: string;
  meta: string;
  leading?: HTMLElement;
  onEdit: () => void;
  removeLabel: string;
  onRemove: () => void;
}

/** A list item with a title, a meta line, and Edit/Remove buttons. */
export function listRow({
  title,
  meta,
  leading,
  onEdit,
  removeLabel,
  onRemove,
}: ListRowOptions): HTMLDivElement {
  const edit = createEl("button", {
    className: "button button--compact",
    text: "Edit",
    attrs: { type: "button" },
  });
  edit.addEventListener("click", onEdit);

  const remove = createEl("button", {
    className: "button button--compact button--danger",
    text: removeLabel,
    attrs: { type: "button" },
  });
  remove.addEventListener("click", onRemove);

  return createEl("div", {
    className: "list-item",
    children: [
      leading,
      createEl("div", {
        className: "list-item__text",
        children: [
          createEl("p", { className: "list-item__title", text: title }),
          createEl("p", { className: "list-item__meta", text: meta }),
        ],
      }),
      createEl("div", { className: "list-item__actions", children: [edit, remove] }),
    ],
  });
}

/** Entries a scrollable settings list shows before it scrolls; the half row hints at more. */
export const VISIBLE_LIST_ROWS = 5.5;

/**
 * Caps a `.list--scroll` list at `rows` entries. Rows share one layout, so a single measured
 * row gives the height. A closed section has no layout, so call this again when it opens.
 */
export function fitListToRows(list: HTMLElement, rows = VISIBLE_LIST_ROWS): void {
  const firstRow = list.firstElementChild;
  if (!(firstRow instanceof HTMLElement) || firstRow.offsetHeight === 0) {
    return;
  }
  const style = getComputedStyle(list);
  const gap = parseFloat(style.rowGap) || 0;
  const frame =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth);
  const gaps = Math.ceil(rows) - 1;
  const height = rows * firstRow.offsetHeight + gaps * gap + frame;
  list.style.maxHeight = `${Math.ceil(height)}px`;
}

/** Runs `action` with `button` disabled, re-enabling it afterwards. */
export async function withDisabled<T>(
  button: HTMLButtonElement,
  action: () => Promise<T>
): Promise<T> {
  button.disabled = true;
  try {
    return await action();
  } finally {
    button.disabled = false;
  }
}
