export function createEl(tag, options = {}) {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = String(options.text);
  }

  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, String(value));
      }
    }
  }

  if (options.props) {
    Object.assign(element, options.props);
  }

  if (options.dataset) {
    for (const [name, value] of Object.entries(options.dataset)) {
      element.dataset[name] = String(value);
    }
  }

  if (options.children) {
    element.append(...options.children.filter(Boolean));
  }

  return element;
}

export function clearElement(element) {
  if (element) {
    element.replaceChildren();
  }
}

export function setText(element, value) {
  if (element) {
    element.textContent = value === undefined || value === null ? "" : String(value);
  }
}

export function setHidden(element, hidden) {
  if (element) {
    element.hidden = Boolean(hidden);
  }
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function debounce(callback, delay = 150) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

export function createId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
