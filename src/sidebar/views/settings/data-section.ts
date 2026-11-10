import { getElement, setText } from "../../../lib/dom.js";
import { estimateStorageBytes } from "../../../lib/storage.js";
import { formatBytes } from "../../../lib/i18n/format.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import type { SettingsSection } from "./shared.js";
import { t } from "../../../lib/i18n/index.js";

/** Storage usage, cache clearing, full reset, and the version label. */
export function initDataSection(app: AppContext, onReset: () => void): SettingsSection {
  const storageUsage = getElement("storage-usage", HTMLParagraphElement);
  const version = getElement("version", HTMLSpanElement);

  getElement("clear-cache", HTMLButtonElement).addEventListener("click", () => {
    void app.clearCache().then(() => {
      showToast(t("settings-data-cache-cleared"));
    });
  });

  getElement("reset-data", HTMLButtonElement).addEventListener("click", () => {
    if (!window.confirm(t("settings-data-confirm-reset"))) {
      return;
    }
    void app.resetAll().then(() => {
      onReset();
      showToast(t("settings-data-purged"));
    });
  });

  setText(version, browser.runtime.getManifest().version);

  return {
    render() {
      setText(
        storageUsage,
        t("settings-data-storage", { size: formatBytes(estimateStorageBytes(app.state)) })
      );
    },
  };
}
