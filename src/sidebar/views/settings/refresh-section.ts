import { getElement } from "../../../lib/dom.js";
import type { RefreshSettings } from "../../../lib/types.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import type { SettingsSection } from "./shared.js";
import { t } from "../../../lib/i18n/index.js";

export function initRefreshSection(app: AppContext): SettingsSection {
  const interval = getElement("refresh-interval", HTMLSelectElement);
  const enabled = getElement("refresh-enabled", HTMLInputElement);

  async function updateRefresh(partial: Partial<RefreshSettings>, message: string): Promise<void> {
    const { settings } = app.state;
    await app.persistSettings({ ...settings, refresh: { ...settings.refresh, ...partial } });
    showToast(message);
  }

  interval.addEventListener("change", () => {
    void updateRefresh(
      { intervalMinutes: Number(interval.value) },
      t("settings-fetching-schedule-updated")
    );
  });

  enabled.addEventListener("change", () => {
    void updateRefresh(
      { enabled: enabled.checked },
      enabled.checked ? t("settings-fetching-background-on") : t("settings-fetching-background-off")
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
