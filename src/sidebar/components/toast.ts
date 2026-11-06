import { getElement } from "../../lib/dom.js";

const DEFAULT_DURATION_MS = 4000;

let hideTimer: number | undefined;

export interface ToastOptions {
  duration?: number;
  error?: boolean;
}

export function showToast(
  message: string,
  { duration = DEFAULT_DURATION_MS, error = false }: ToastOptions = {}
): void {
  const element = getElement("toast", HTMLDivElement);

  window.clearTimeout(hideTimer);
  element.textContent = message;
  element.classList.toggle("toast--error", error);
  element.hidden = false;

  hideTimer = window.setTimeout(() => {
    element.hidden = true;
  }, duration);
}

export function showError(message: string): void {
  showToast(message, { error: true });
}
