import type { TabId } from "../../lib/types.js";

const TAB_PREFIX = "tab-";
const PANEL_PREFIX = "panel-";

export interface TabsOptions {
  tabs: readonly HTMLElement[];
  panels: readonly HTMLElement[];
  initialId: TabId;
  onChange?: (id: TabId) => void;
}

export interface Tabs {
  activate(id: TabId, options?: { focus?: boolean }): void;
}

function tabIdOf(tab: HTMLElement): TabId {
  return tab.id.slice(TAB_PREFIX.length) as TabId;
}

/** Index of the tab to move to for a WAI-ARIA tablist key, or `null` for other keys. */
function nextIndexForKey(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Wires an accessible tablist (roving tabindex, arrow/Home/End keys). */
export function initTabs({ tabs, panels, initialId, onChange }: TabsOptions): Tabs {
  function activate(id: TabId, { focus = false }: { focus?: boolean } = {}): void {
    for (const tab of tabs) {
      const selected = tab.id === `${TAB_PREFIX}${id}`;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) {
        tab.focus();
      }
    }

    for (const panel of panels) {
      panel.hidden = panel.id !== `${PANEL_PREFIX}${id}`;
    }

    onChange?.(id);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activate(tabIdOf(tab));
    });

    tab.addEventListener("keydown", (event) => {
      const nextIndex = nextIndexForKey(event.key, index, tabs.length);
      const nextTab = nextIndex === null ? undefined : tabs[nextIndex];
      if (nextTab) {
        event.preventDefault();
        activate(tabIdOf(nextTab), { focus: true });
      }
    });
  });

  const hasInitial = tabs.some((tab) => tabIdOf(tab) === initialId);
  activate(hasInitial ? initialId : "feed");

  return { activate };
}
