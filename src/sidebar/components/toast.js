let hideTimer = 0;

export function showToast(message, { duration = 4000, error = false } = {}) {
  const element = document.getElementById("toast");
  if (!element) {
    return;
  }

  window.clearTimeout(hideTimer);
  element.textContent = message;
  element.classList.toggle("toast--error", Boolean(error));
  element.hidden = false;

  hideTimer = window.setTimeout(() => {
    element.hidden = true;
  }, duration);
}

export function hideToast() {
  const element = document.getElementById("toast");
  window.clearTimeout(hideTimer);
  if (element) {
    element.hidden = true;
  }
}
