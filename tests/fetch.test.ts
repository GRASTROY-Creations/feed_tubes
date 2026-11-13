import { afterEach, describe, expect, it } from "bun:test";
import { HttpError, NetworkError } from "../src/lib/errors.js";
import { fetchJson, fetchText, parseRetryAfter, postJson, retryDelayMs } from "../src/lib/fetch.js";
import { rejectionOf } from "./fixtures.js";

const originalFetch = globalThis.fetch;

type Step = () => Response;

/** Replaces `fetch` with a stub that plays `steps` in order and counts calls. */
function stubFetch(steps: Step[]): { calls: () => number } {
  let calls = 0;
  globalThis.fetch = Object.assign(
    () => {
      const step = steps[Math.min(calls, steps.length - 1)];
      calls += 1;
      if (!step) {
        throw new Error("No stubbed response.");
      }
      return Promise.resolve().then(step);
    },
    { preconnect: originalFetch.preconnect }
  );
  return { calls: () => calls };
}

const ok =
  (body: string): Step =>
  () =>
    new Response(body, { status: 200 });
const status =
  (code: number): Step =>
  () =>
    new Response("", { status: code });
const networkError: Step = () => {
  throw new TypeError("NetworkError when attempting to fetch resource.");
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchText", () => {
  it("retries once on a server error", async () => {
    const stub = stubFetch([status(503), ok("hello")]);
    expect(await fetchText("https://example.com/")).toBe("hello");
    expect(stub.calls()).toBe(2);
  });

  it("retries once on a network error", async () => {
    const stub = stubFetch([networkError, ok("hello")]);
    expect(await fetchText("https://example.com/")).toBe("hello");
    expect(stub.calls()).toBe(2);
  });

  it("does not retry client errors", async () => {
    const stub = stubFetch([status(404), ok("never")]);
    const error = await rejectionOf(fetchText("https://example.com/"));
    expect(error).toBeInstanceOf(HttpError);
    expect(stub.calls()).toBe(1);
  });

  it("does not retry when retries is 0", async () => {
    const stub = stubFetch([status(503), ok("never")]);
    const error = await rejectionOf(fetchText("https://example.com/", { retries: 0 }));
    expect(error.message).toBe("Request failed with HTTP 503 (https://example.com/).");
    expect(stub.calls()).toBe(1);
  });

  it("does not retry a request the caller aborted", async () => {
    const controller = new AbortController();
    const stub = stubFetch([
      () => {
        controller.abort();
        throw new TypeError("aborted");
      },
      ok("never"),
    ]);
    const error = await rejectionOf(
      fetchText("https://example.com/", { signal: controller.signal })
    );
    expect(error.message).toBe("Could not reach https://example.com/: aborted");
    expect(stub.calls()).toBe(1);
  });

  it("names the URL when the network request fails for good", async () => {
    stubFetch([networkError]);
    const error = await rejectionOf(fetchText("https://example.com/feed"));
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toBe(
      "Could not reach https://example.com/feed: NetworkError when attempting to fetch resource."
    );
  });
});

describe("postJson", () => {
  it("sends a JSON body and parses the JSON response", async () => {
    let sent: { method?: string; body?: unknown; contentType?: string } = {};
    globalThis.fetch = Object.assign(
      (_url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        sent = {
          method: init?.method,
          body: init?.body,
          contentType: headers.get("Content-Type") ?? "",
        };
        return Promise.resolve(new Response('{"ok":true}'));
      },
      { preconnect: originalFetch.preconnect }
    );

    expect(await postJson("https://example.com/api", { a: 1 })).toEqual({ ok: true });
    expect(sent).toEqual({ method: "POST", body: '{"a":1}', contentType: "application/json" });
  });
});

describe("fetchJson", () => {
  it("parses JSON bodies", async () => {
    stubFetch([ok('{"data":[1]}')]);
    expect(await fetchJson("https://example.com/")).toEqual({ data: [1] });
  });
});

describe("rate limits", () => {
  it("does not retry 429 and keeps the server's Retry-After", async () => {
    const stub = stubFetch([
      () => new Response("", { status: 429, headers: { "Retry-After": "120" } }),
      ok("never"),
    ]);
    const error = await rejectionOf(fetchText("https://example.com/"));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).retryAfterMs).toBe(120_000);
    expect(stub.calls()).toBe(1);
  });

  it("reads Retry-After as seconds or as a date", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(parseRetryAfter("30", now)).toBe(30_000);
    expect(parseRetryAfter("Fri, 13 Nov 2026 12:01:00 GMT", now)).toBe(60_000);
    expect(parseRetryAfter("soon", now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });

  it("backs off exponentially with jitter", () => {
    expect(retryDelayMs(0, () => 0)).toBe(500);
    expect(retryDelayMs(2, () => 0)).toBe(2000);
    expect(retryDelayMs(0, () => 0.99)).toBeLessThan(750);
  });
});
