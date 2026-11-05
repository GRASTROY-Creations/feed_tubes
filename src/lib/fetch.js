const DEFAULT_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 500;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function request(url, options = {}) {
  const {
    responseType = "text",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 1,
    signal,
    accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: accept },
      });

      if (!response.ok) {
        const error = new Error(`Request failed with HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }

      return responseType === "json" ? await response.json() : await response.text();
    } catch (error) {
      lastError = error;
      const retryable =
        !controller.signal.aborted || signal?.aborted !== true
          ? isRetryableStatus(error.status) || error.name === "TypeError"
          : false;

      if (attempt >= retries || !retryable) {
        throw error;
      }

      await wait(RETRY_DELAY_MS);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  throw lastError || new Error("Request failed.");
}

export function fetchText(url, options = {}) {
  return request(url, { ...options, responseType: "text" });
}

export function fetchJson(url, options = {}) {
  return request(url, { ...options, responseType: "json" });
}
