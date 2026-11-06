import { errorMessage } from "../lib/errors.js";
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

const MINUTE_MS = 60 * 1000;
const DEFAULT_CACHE_TTL_MINUTES = 15;

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

  renderAll(): void {
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

  async refresh({ manual = false }: { manual?: boolean } = {}): Promise<void> {
    if (this.#refreshing) {
      return;
    }

    this.#refreshing = true;
    this.renderAll();

    try {
      const result = await sendRequest("refresh-request");
      if (!result.ok) {
        throw new Error(result.error);
      }
      if (manual) {
        reportManualRefresh(result);
      }
      await this.reload();
    } catch (error) {
      showError(errorMessage(error, "Could not refresh feeds."));
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

  /** Refreshes on open when there are enabled subscriptions and the cache is stale. */
  async refreshIfStale(): Promise<void> {
    const { subscriptions, refreshState, settings } = this.state;
    if (!subscriptions.some((subscription) => subscription.enabled)) {
      return;
    }

    const lastCompleted = Date.parse(refreshState.lastCompletedAt ?? "") || 0;
    const ttlMinutes = settings.feed.cacheTtlMinutes || DEFAULT_CACHE_TTL_MINUTES;
    if (Date.now() - lastCompleted > ttlMinutes * MINUTE_MS) {
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
        showError(event.error);
      } else if (event.reason === "alarm") {
        showToast("Feed refreshed in the background.");
      }
    })
    .catch(() => {
      showError("Could not reload the feed.");
    });
}

async function start(): Promise<void> {
  const app = new App();
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
      showError("Host access was removed. Some sources need access again.");
      void app.reload();
    }
  });

  await app.refreshIfStale();
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
