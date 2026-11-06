import { getElement } from "../../../lib/dom.js";
import type { RefreshSettings } from "../../../lib/types.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import type { SettingsSection } from "./shared.js";

export function initRefreshSection(app: AppContext): SettingsSection {
  const interval = getElement("refresh-interval", HTMLSelectElement);
  const enabled = getElement("refresh-enabled", HTMLInputElement);

  async function updateRefresh(partial: Partial<RefreshSettings>, message: string): Promise<void> {
    const { settings } = app.state;
    await app.persistSettings({ ...settings, refresh: { ...settings.refresh, ...partial } });
    showToast(message);
  }

  interval.addEventListener("change", () => {
    void updateRefresh({ intervalMinutes: Number(interval.value) }, "Refresh schedule updated.");
  });

  enabled.addEventListener("change", () => {
    void updateRefresh(
      { enabled: enabled.checked },
      enabled.checked ? "Background refresh enabled." : "Background refresh disabled."
    );
  });

  return {
    render() {
      const { refresh } = app.state.settings;
      interval.value = String(refresh.intervalMinutes);
      enabled.checked = refresh.enabled;
    },
  };
}
