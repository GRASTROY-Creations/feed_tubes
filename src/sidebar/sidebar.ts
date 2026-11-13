import { localizedErrorMessage, LocalizedError } from "../lib/errors.js";
import { getElement } from "../lib/dom.js";
import { isFeedUpdatedEvent, sendRequest, type FeedUpdatedEvent } from "../lib/messages.js";
import { originsForSubscriptions, requestOrigins } from "../lib/permissions.js";
import {
  clearCache as clearStoredCache,
  loadState,
  resetAll as resetStoredData,
  saveSettings,
  saveSubscriptions,
} from "../lib/storage.js";
import type { RefreshSummary } from "../lib/refresh.js";
import { describeRefresh } from "../lib/refresh-report.js";
import type { AppState, Settings, Subscription, TabId, UiSettings } from "../lib/types.js";
import type { AppContext, View } from "./app-context.js";
import { initTabs, type Tabs } from "./components/tabs.js";
import { showError, showToast } from "./components/toast.js";
import { initFeedView } from "./views/feed-view.js";
import { initSettingsView } from "./views/settings-view.js";
import { applyTranslations } from "../lib/i18n/dom.js";
import { applyLanguageSetting, loadLocales, t, translate } from "../lib/i18n/index.js";

class App implements AppContext {
  #state: AppState | null = null;
  #refreshing = false;
  #views: View[] = [];
  #tabs: Tabs | null = null;

  get state(): AppState {
    if (!this.#state) {
      throw new Error("The sidebar state has not been loaded yet.");
    }
    return this.#state;
  }

  get refreshing(): boolean {
    return this.#refreshing;
  }

  attach(views: View[], tabs: Tabs): void {
    this.#views = views;
    this.#tabs = tabs;
  }

  /**
   * Re-renders every view in the stored interface language. Static markup is translated here
   * too, so a language change applies everywhere without reloading the sidebar.
   */
  renderAll(): void {
    if (this.#state) {
      applyLanguageSetting(this.#state.settings.ui.language);
      applyTranslations(document);
    }
    for (const view of this.#views) {
      view.render();
    }
  }

  async reload(): Promise<void> {
    this.#state = await loadState();
    this.renderAll();
  }

  async persistSettings(settings: Settings): Promise<void> {
    this.state.settings = settings;
    await saveSettings(settings);
    this.renderAll();
    try {
      await sendRequest("settings-changed");
    } catch {
      // The background script may be asleep; it also reschedules the alarm at startup.
    }
  }

  async persistSubscriptions(subscriptions: Subscription[]): Promise<void> {
    this.state.subscriptions = subscriptions;
    await saveSubscriptions(subscriptions);
    this.renderAll();
  }

  async updateUi(partial: Partial<UiSettings>): Promise<void> {
    const { settings } = this.state;
    const next = { ...settings, ui: { ...settings.ui, ...partial } };
    this.state.settings = next;
    await saveSettings(next);
    this.renderAll();
  }

  openSettings(): void {
    this.#tabs?.activate("settings");
  }

  async requestPermissions(): Promise<boolean> {
    const enabled = this.state.subscriptions.filter((subscription) => subscription.enabled);
    return requestOrigins(originsForSubscriptions(enabled));
  }

  /**
   * `manual` (the refresh button) fetches everything past the short cooldown; otherwise only
   * subscriptions that are due are fetched. Either way, large lists are fetched in batches.
   */
  async refresh({ manual = false }: { manual?: boolean } = {}): Promise<void> {
    if (this.#refreshing) {
      return;
    }

    this.#refreshing = true;
    this.renderAll();

    try {
      const result = await sendRequest(manual ? "refresh-request" : "refresh-due");
      if (!result.ok) {
        throw new LocalizedError(result.error.id, result.error.args);
      }
      if (manual) {
        reportManualRefresh(result);
      }
      await this.reload();
    } catch (error) {
      showError(localizedErrorMessage(error, "app-error-refresh-failed"));
    } finally {
      this.#refreshing = false;
      this.renderAll();
    }
  }

  async clearCache(): Promise<void> {
    await clearStoredCache();
    await this.reload();
  }

  async resetAll(): Promise<void> {
    await resetStoredData();
    await this.reload();
  }

  /**
   * On open, the stored feed is shown right away; only subscriptions whose check interval
   * has passed are fetched. When none are due, the background sends no request at all.
   */
  async refreshDue(): Promise<void> {
    if (this.state.subscriptions.some((subscription) => subscription.enabled)) {
      await this.refresh();
    }
  }
}

function reportManualRefresh(summary: RefreshSummary): void {
  const { message, error } = describeRefresh(summary);
  showToast(message, { error });
}

function handleFeedUpdated(app: App, event: FeedUpdatedEvent): void {
  app
    .reload()
    .then(() => {
      if (event.error) {
        showError(translate(event.error));
      } else if (event.reason === "alarm" && !event.progress && (event.fetched ?? 0) > 0) {
        showToast(t("app-toast-background-refreshed"));
      }
    })
    .catch(() => {
      showError(t("app-error-reload-failed"));
    });
}

async function start(): Promise<void> {
  // Firefox's accessibility audit reads `.title` on the document's DOM node, which can be the
  // root element rather than the Document, so set both.
  document.title = "FeedTubes";
  document.documentElement.title = "FeedTubes";
  const app = new App();
  // Every language is loaded up front, so switching the language later is instant. Loading
  // must finish before the first render (`reload()` renders), or the markup stays untranslated.
  await loadLocales();
  await app.reload();

  const feedView = initFeedView(app);
  const settingsView = initSettingsView(app);

  const tabs = initTabs({
    tabs: [
      getElement("tab-feed", HTMLButtonElement),
      getElement("tab-settings", HTMLButtonElement),
    ],
    panels: [getElement("panel-feed", HTMLElement), getElement("panel-settings", HTMLElement)],
    initialId: app.state.settings.ui.activeTab,
    onChange: (activeTab: TabId) => {
      if (app.state.settings.ui.activeTab !== activeTab) {
        void app.updateUi({ activeTab });
      }
    },
  });

  app.attach([feedView, settingsView], tabs);
  app.renderAll();

  getElement("refresh-button", HTMLButtonElement).addEventListener("click", () => {
    void app.refresh({ manual: true });
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isFeedUpdatedEvent(message)) {
      handleFeedUpdated(app, message);
    }
    return undefined;
  });

  browser.permissions.onRemoved.addListener((permissions) => {
    if (permissions.origins?.length) {
      showError(t("app-error-access-removed"));
      void app.reload();
    }
  });

  await app.refreshDue();
}

function startSafely(): void {
  start().catch((error: unknown) => {
    console.error("FeedTubes sidebar failed to start.", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startSafely, { once: true });
} else {
  startSafely();
}
