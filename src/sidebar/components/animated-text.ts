/**
 * Cycling dots for the refreshing status texts. The base text ("Refreshing feed") stays in the
 * element and in the accessibility tree; only an `aria-hidden` span cycles "." → ".." → "…".
 * That keeps an `aria-live` status from being re-announced on every step of the cycle.
 */

/** One cycle of the animation; the last step is the single-character ellipsis. */
export const DOT_SUFFIXES: readonly string[] = [".", "..", "…"];
export const DOT_INTERVAL_MS = 400;

/** The suffix shown at `step`, wrapping around the cycle. */
export function dotSuffix(step: number): string {
  return DOT_SUFFIXES[step % DOT_SUFFIXES.length] ?? ".";
}

/** The timer functions the animator needs; injectable so tests run without real timers. */
export interface DotClock {
  setInterval(callback: () => void, milliseconds: number): number;
  clearInterval(handle: number): void;
}

export interface DotAnimator {
  /** Shows `base` plus the current dots; starts the cycle when the first element appears. */
  set(element: HTMLElement, base: string): void;
  /** Stops animating `element`, leaving the plain base text behind. */
  clear(element: HTMLElement): void;
}

export function createDotAnimator(
  clock: DotClock = window,
  createDots: () => HTMLElement = () => document.createElement("span")
): DotAnimator {
  interface Target {
    base: string;
    dots: HTMLElement;
  }

  const targets = new Map<HTMLElement, Target>();
  let step = 0;
  let timer: number | undefined;

  function paint(target: Target): void {
    target.dots.textContent = dotSuffix(step);
  }

  function tick(): void {
    step = (step + 1) % DOT_SUFFIXES.length;
    for (const target of targets.values()) {
      paint(target);
    }
  }

  function set(element: HTMLElement, base: string): void {
    let target = targets.get(element);
    if (!target) {
      const dots = createDots();
      dots.setAttribute("aria-hidden", "true");
      target = { base, dots };
      targets.set(element, target);
      timer ??= clock.setInterval(tick, DOT_INTERVAL_MS);
    }
    // Rebuild the text on every call: `applyTranslations` may have replaced the element's
    // children since the last render. The phase and the shared timer are kept, so re-renders
    // during a refresh neither restart nor visibly reset the cycle.
    target.base = base;
    element.textContent = base;
    element.appendChild(target.dots);
    paint(target);
  }

  function clear(element: HTMLElement): void {
    const target = targets.get(element);
    if (!target) {
      return;
    }
    targets.delete(element);
    element.textContent = target.base;
    if (targets.size === 0 && timer !== undefined) {
      clock.clearInterval(timer);
      timer = undefined;
      step = 0;
    }
  }

  return { set, clear };
}
