export function initTabs({ tabs, panels, initialId = "feed", onChange }) {
  const tabList = tabs.filter(Boolean);
  const panelList = panels.filter(Boolean);

  function tabForId(id) {
    return tabList.find((tab) => tab.id === `tab-${id}`);
  }

  function activate(id, { focus = false } = {}) {
    for (const tab of tabList) {
      const selected = tab.id === `tab-${id}`;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) {
        tab.focus();
      }
    }

    for (const panel of panelList) {
      panel.hidden = panel.id !== `panel-${id}`;
    }

    onChange?.(id);
  }

  for (const tab of tabList) {
    tab.addEventListener("click", () => {
      activate(tab.id.replace(/^tab-/, ""));
    });

    tab.addEventListener("keydown", (event) => {
      const index = tabList.indexOf(tab);
      let nextIndex = null;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % tabList.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + tabList.length) % tabList.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabList.length - 1;
      }

      if (nextIndex === null) {
        return;
      }

      event.preventDefault();
      const nextTab = tabList[nextIndex];
      activate(nextTab.id.replace(/^tab-/, ""), { focus: true });
    });
  }

  const initialTab = tabForId(initialId) ? initialId : "feed";
  activate(initialTab);

  return { activate };
}
