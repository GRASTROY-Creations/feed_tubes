import type { AppContext, View } from "../app-context.js";
import { initDataSection } from "./settings/data-section.js";
import { initInstancesSection } from "./settings/instances-section.js";
import { initApiKeysSection } from "./settings/api-keys-section.js";
import { initRefreshSection } from "./settings/refresh-section.js";
import type { SettingsSection } from "./settings/shared.js";
import { initSubscriptionsSection } from "./settings/subscriptions-section.js";
import { initTransferSection } from "./settings/transfer-section.js";

/** The settings panel, composed of independent sections. */
export function initSettingsView(app: AppContext): View {
  const sections: SettingsSection[] = [
    initInstancesSection(app),
    initSubscriptionsSection(app),
    initRefreshSection(app),
    initApiKeysSection(app),
    initTransferSection(app),
  ];

  const resetForms = (): void => {
    for (const section of sections) {
      section.reset?.();
    }
  };
  sections.push(initDataSection(app, resetForms));

  return {
    render() {
      for (const section of sections) {
        section.render?.();
      }
    },
  };
}
