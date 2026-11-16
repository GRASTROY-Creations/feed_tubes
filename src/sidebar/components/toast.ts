import { getElement } from "../../lib/dom.js";

const DEFAULT_DURATION_MS = 4000;

let hideTimer: number | undefined;
let closeBound = false;

export interface ToastOptions {
  duration?: number;
  error?: boolean;
}

function hideToast(): void {
  window.clearTimeout(hideTimer);
  hideTimer = undefined;
  getElement("toast", HTMLDivElement).hidden = true;
}

function bindCloseButton(): void {
  if (closeBound) {
    return;
  }
  closeBound = true;
  getElement("toast-close", HTMLButtonElement).addEventListener("click", hideToast);
}

export function showToast(
  message: string,
  { duration = DEFAULT_DURATION_MS, error = false }: ToastOptions = {}
): void {
  const element = getElement("toast", HTMLDivElement);
  const messageElement = getElement("toast-message", HTMLSpanElement);

  window.clearTimeout(hideTimer);
  hideTimer = undefined;
  messageElement.textContent = message;
  element.classList.toggle("toast--error", error);
  element.hidden = false;
  bindCloseButton();

  // Errors stay visible until the user dismisses them; ordinary confirmations still auto-hide.
  if (!error && duration > 0) {
    hideTimer = window.setTimeout(hideToast, duration);
  }
}

export function showError(message: string): void {
  showToast(message, { error: true });
}
