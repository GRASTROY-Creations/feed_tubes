import { createOption, getElement } from "../../../lib/dom.js";
import { isLanguageSetting, LANGUAGE_OPTIONS, t } from "../../../lib/i18n/index.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import type { SettingsSection } from "./shared.js";

/** The interface language select in Settings → General. Changes apply immediately. */
export function initLanguageSection(app: AppContext): SettingsSection {
  const select = getElement("language-select", HTMLSelectElement);

  select.addEventListener("change", () => {
    const language = select.value;
    if (!isLanguageSetting(language)) {
      return;
    }
    const { settings } = app.state;
    void app.persistSettings({ ...settings, ui: { ...settings.ui, language } }).then(() => {
      // Shown in the newly chosen language.
      showToast(t("settings-language-changed"));
    });
  });

  return {
    render() {
      // Rebuilt on every render so "Automatic" is labelled in the current language.
      // Language names stay in their own language, so everyone can find theirs.
      select.replaceChildren(
        ...LANGUAGE_OPTIONS.map((option) =>
          createOption(option.value, option.nativeName ?? t("settings-language-auto"))
        )
      );
      select.value = app.state.settings.ui.language;
    },
  };
}
