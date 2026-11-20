import { describe, expect, it } from "bun:test";
import {
  createDotAnimator,
  DOT_INTERVAL_MS,
  dotSuffix,
  type DotClock,
} from "../src/sidebar/components/animated-text.js";

/** A clock whose interval only fires when the test calls `tick()`. */
function fakeClock() {
  let callback: (() => void) | undefined;
  let starts = 0;
  let clears = 0;
  const clock: DotClock = {
    setInterval: (fn, milliseconds) => {
      expect(milliseconds).toBe(DOT_INTERVAL_MS);
      callback = fn;
      starts += 1;
      return starts;
    },
    clearInterval: () => {
      callback = undefined;
      clears += 1;
    },
  };
  return {
    clock,
    tick: () => {
      callback?.();
    },
    running: () => callback !== undefined,
    starts: () => starts,
    clears: () => clears,
  };
}

/** Minimal element stub; like the DOM, assigning textContent removes the children. */
interface FakeElement {
  textContent: string | null;
  children: FakeElement[];
  attributes: Record<string, string>;
  appendChild(child: FakeElement): FakeElement;
  setAttribute(name: string, value: string): void;
}

function fakeElement(): FakeElement {
  const children: FakeElement[] = [];
  const attributes: Record<string, string> = {};
  let text = "";
  return {
    get textContent() {
      return text;
    },
    set textContent(value: string | null) {
      text = value ?? "";
      children.length = 0;
    },
    appendChild(child: FakeElement) {
      children.push(child);
      return child;
    },
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
    children,
    attributes,
  };
}

/** The animator only uses textContent, appendChild and setAttribute, which the stub provides. */
function asHtml(element: FakeElement): HTMLElement {
  return element as unknown as HTMLElement;
}

function dotsOf(element: FakeElement): FakeElement {
  const dots = element.children[0];
  if (!dots) {
    throw new Error("Expected an animated dots span.");
  }
  return dots;
}

describe("dot suffix cycle", () => {
  it("cycles . .. … and wraps around", () => {
    expect(dotSuffix(0)).toBe(".");
    expect(dotSuffix(1)).toBe("..");
    expect(dotSuffix(2)).toBe("…");
    expect(dotSuffix(3)).toBe(".");
    expect(dotSuffix(7)).toBe("..");
  });
});

describe("dot animator", () => {
  it("shows the base text plus an aria-hidden dots span", () => {
    const { clock } = fakeClock();
    const animator = createDotAnimator(clock, () => asHtml(fakeElement()));
    const element = fakeElement();

    animator.set(asHtml(element), "Refreshing feed");

    expect(element.textContent).toBe("Refreshing feed");
    expect(element.children).toHaveLength(1);
    expect(element.attributes).toEqual({});
    expect(dotsOf(element).textContent).toBe(".");
    expect(dotsOf(element).attributes).toEqual({ "aria-hidden": "true" });
  });

  it("advances every animated element together on each tick", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const status = fakeElement();
    const title = fakeElement();

    animator.set(asHtml(status), "Refreshing feed");
    animator.set(asHtml(title), "Refreshing feed");
    expect(timers.starts()).toBe(1);

    timers.tick();
    expect(dotsOf(status).textContent).toBe("..");
    expect(dotsOf(title).textContent).toBe("..");
    timers.tick();
    expect(dotsOf(status).textContent).toBe("…");
    timers.tick();
    expect(dotsOf(status).textContent).toBe(".");
  });

  it("keeps the phase and the timer when re-rendered with the same text", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const element = fakeElement();

    animator.set(asHtml(element), "Refreshing feed");
    timers.tick();
    animator.set(asHtml(element), "Refreshing feed");

    expect(dotsOf(element).textContent).toBe("..");
    expect(element.children).toHaveLength(1);
    expect(timers.starts()).toBe(1);
    expect(timers.running()).toBe(true);
  });

  it("restores the dots when the text was replaced between renders", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const element = fakeElement();

    animator.set(asHtml(element), "Refreshing feed");
    timers.tick();
    // `applyTranslations` rewrites data-i18n elements on every renderAll.
    element.textContent = "No subscriptions yet";
    animator.set(asHtml(element), "Refreshing feed");

    expect(element.textContent).toBe("Refreshing feed");
    expect(dotsOf(element).textContent).toBe("..");
  });

  it("follows a language change without resetting the phase", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const element = fakeElement();

    animator.set(asHtml(element), "Refreshing feed");
    timers.tick();
    animator.set(asHtml(element), "Обновление ленты");

    expect(element.textContent).toBe("Обновление ленты");
    expect(dotsOf(element).textContent).toBe("..");
  });

  it("stops the timer only when the last element is cleared", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const status = fakeElement();
    const title = fakeElement();

    animator.set(asHtml(status), "Refreshing feed");
    animator.set(asHtml(title), "Refreshing feed");
    animator.clear(asHtml(status));
    expect(status.textContent).toBe("Refreshing feed");
    expect(status.children).toHaveLength(0);
    expect(timers.running()).toBe(true);

    animator.clear(asHtml(title));
    expect(timers.running()).toBe(false);
    expect(timers.clears()).toBe(1);
  });

  it("starts a new cycle from the first suffix after everything was cleared", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const element = fakeElement();

    animator.set(asHtml(element), "Refreshing feed");
    timers.tick();
    timers.tick();
    animator.clear(asHtml(element));
    animator.set(asHtml(element), "Refreshing feed");

    expect(dotsOf(element).textContent).toBe(".");
    expect(timers.starts()).toBe(2);
  });

  it("ignores clearing an element that is not animated", () => {
    const timers = fakeClock();
    const animator = createDotAnimator(timers.clock, () => asHtml(fakeElement()));
    const element = fakeElement();

    animator.clear(asHtml(element));

    expect(element.textContent).toBe("");
    expect(timers.clears()).toBe(0);
  });
});
