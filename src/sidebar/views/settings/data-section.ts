import { getElement, setText } from "../../../lib/dom.js";
import { estimateStorageBytes } from "../../../lib/storage.js";
import { formatBytes } from "../../../lib/text.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import type { SettingsSection } from "./shared.js";

/** Storage usage, cache clearing, full reset, and the version label. */
export function initDataSection(app: AppContext, onReset: () => void): SettingsSection {
  const storageUsage = getElement("storage-usage", HTMLParagraphElement);
  const version = getElement("version", HTMLSpanElement);

  getElement("clear-cache", HTMLButtonElement).addEventListener("click", () => {
    void app.clearCache().then(() => {
      showToast("Feed cache cleared.");
    });
  });

  getElement("reset-data", HTMLButtonElement).addEventListener("click", () => {
    if (!window.confirm("Reset all FeedTubes data, including subscriptions and settings?")) {
      return;
    }
    void app.resetAll().then(() => {
      onReset();
      showToast("All data reset.");
    });
  });

  setText(version, browser.runtime.getManifest().version);

  return {
    render() {
      setText(
        storageUsage,
        `Stored data: ${formatBytes(estimateStorageBytes(app.state))}. Cache clears safely; subscriptions and settings are kept.`
      );
    },
  };
}
