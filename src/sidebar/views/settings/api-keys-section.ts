import { getElement } from "../../../lib/dom.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import type { SettingsSection } from "./shared.js";

/** Personal API keys (currently only Pixabay), saved when the field loses focus. */
export function initApiKeysSection(app: AppContext): SettingsSection {
  const pixabay = getElement("pixabay-api-key", HTMLInputElement);

  pixabay.addEventListener("change", () => {
    const key = pixabay.value.trim();
    const { settings } = app.state;
    if (key === settings.apiKeys.pixabay) {
      return;
    }
    void app
      .persistSettings({ ...settings, apiKeys: { ...settings.apiKeys, pixabay: key } })
      .then(() => {
        showToast(key ? "Pixabay API key saved." : "Pixabay API key removed.");
      });
  });

  return {
    render() {
      // Never overwrite what the user is typing.
      if (document.activeElement !== pixabay) {
        pixabay.value = app.state.settings.apiKeys.pixabay;
      }
    },
  };
}
