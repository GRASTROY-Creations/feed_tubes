type AttributeValue = string | number | boolean | null | undefined;

export interface ElementOptions<K extends keyof HTMLElementTagNameMap> {
  className?: string;
  text?: string | number;
  attrs?: Readonly<Record<string, AttributeValue>>;
  props?: Partial<HTMLElementTagNameMap[K]>;
  dataset?: Readonly<Record<string, string>>;
  children?: readonly (Node | null | undefined)[];
}

/** Builds an element without HTML strings, so untrusted text never reaches an HTML sink. */
export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions<K> = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = String(options.text);
  }

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value !== undefined && value !== null && value !== false) {
      element.setAttribute(name, String(value));
    }
  }

  if (options.props) {
    Object.assign(element, options.props);
  }

  Object.assign(element.dataset, options.dataset);

  if (options.children) {
    element.append(...options.children.filter((child): child is Node => Boolean(child)));
  }

  return element;
}

export function createOption(value: string, label: string, disabled = false): HTMLOptionElement {
  return createEl("option", { text: label, attrs: { value, disabled } });
}

/** Replaces the options of `select`, preserving `selectedValue` when it still exists. */
export function fillSelect(
  select: HTMLSelectElement,
  options: readonly { value: string; label: string }[],
  {
    selectedValue = select.value,
    fallback = "",
  }: { selectedValue?: string; fallback?: string } = {}
): void {
  select.replaceChildren(...options.map((option) => createOption(option.value, option.label)));
  const hasSelected = options.some((option) => option.value === selectedValue);
  select.value = hasSelected ? selectedValue : fallback;
}

/**
 * Looks up a required element by id and checks its type.
 * Throws when the markup and the code disagree, instead of failing later on `null`.
 */
export function getElement<T extends HTMLElement>(
  id: string,
  type: { new (): T; prototype: T }
): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Expected #${id} to be a ${type.name}.`);
  }
  return element;
}

export function setText(element: HTMLElement, value: string): void {
  element.textContent = value;
}

/** Shows `message` in `element`, hiding it when the message is empty. */
/**
 * Shows a message, or hides the element for `""`. Several sentences are shown one per line
 * rather than joined into one string, which would need language-specific punctuation.
 */
export function setMessage(
  element: HTMLElement,
  message: string | readonly string[],
  { error = false }: { error?: boolean } = {}
): void {
  const lines = (typeof message === "string" ? [message] : message).filter(Boolean);
  if (lines.length > 1) {
    element.replaceChildren(
      ...lines.map((line) => createEl("span", { className: "hint__line", text: line }))
    );
  } else {
    element.textContent = lines[0] ?? "";
  }
  element.hidden = lines.length === 0;
  element.classList.toggle("banner--error", error);
}

export function createId(prefix = "id"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
