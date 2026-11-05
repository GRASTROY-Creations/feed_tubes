import { showToast } from "./components/toast.js";
import { initTabs } from "./components/tabs.js";
import { originsForSubscriptions, requestOrigins } from "./lib/permissions.js";
import {
  clearCache as clearStoredCache,
  loadState,
  resetAll as resetStoredData,
  saveSettings,
  saveSubscriptions,
} from "./lib/storage.js";
import { initFeedView } from "./views/feed-view.js";
import { initSettingsView } from "./views/settings-view.js";

let feedView;
let settingsView;
let tabs;

const app = {
  data: null,
  refreshing: false,

  async reload() {
    this.data = await loadState();
    feedView?.render();
    settingsView?.render();
  },

  async persistSettings(settings) {
    this.data.settings = settings;
    await saveSettings(settings);
    feedView?.render();
    settingsView?.render();
    try {
      await browser.runtime.sendMessage({ type: "settings-changed" });
    } catch {
      // The background page can be asleep; the alarm is also scheduled at startup.
    }
  },

  async persistSubscriptions(subscriptions) {
    this.data.subscriptions = subscriptions;
    await saveSubscriptions(subscriptions);
    feedView?.render();
    settingsView?.render();
  },

  async updateUi(partial) {
    const settings = {
      ...this.data.settings,
      ui: { ...this.data.settings.ui, ...partial },
    };
    this.data.settings = settings;
    await saveSettings(settings);
    feedView?.render();
  },

  openSettings() {
    tabs?.activate("settings");
  },

  async requestPermissions() {
    const subscriptions = this.data.subscriptions.filter((subscription) => subscription.enabled);
    return requestOrigins(originsForSubscriptions(subscriptions));
  },

  async refresh({ manual = false } = {}) {
    if (this.refreshing) {
      return;
    }

    this.refreshing = true;
    feedView?.render();

    try {
      const result = await browser.runtime.sendMessage({ type: "refresh-request" });
      if (!result?.ok) {
        throw new Error(result?.error || "Refresh failed.");
      }

      if (manual) {
        if (result.total === 0) {
          showToast("Add an enabled subscription before refreshing.");
        } else if (result.failures > 0) {
          showToast(
            `Refreshed ${result.total} source${result.total === 1 ? "" : "s"}; ${
              result.failures
            } failed.`,
            { error: true }
          );
        } else {
          showToast(`Refreshed ${result.total} source${result.total === 1 ? "" : "s"}.`);
        }
      }

      await this.reload();
    } catch (error) {
      showToast(error?.message || "Could not refresh feeds.", { error: true });
    } finally {
      this.refreshing = false;
      feedView?.render();
    }
  },

  async clearCache() {
    await clearStoredCache();
    await this.reload();
  },

  async resetAll() {
    await resetStoredData();
    await this.reload();
  },
};

async function start() {
  const tabElements = [
    document.getElementById("tab-feed"),
    document.getElementById("tab-settings"),
  ];
  const panelElements = [
    document.getElementById("panel-feed"),
    document.getElementById("panel-settings"),
  ];

  feedView = initFeedView({
    app,
    elements: {
      platformFilter: document.getElementById("platform-filter"),
      channelFilter: document.getElementById("channel-filter"),
      feedError: document.getElementById("feed-error"),
      feedErrorText: document.getElementById("feed-error-text"),
      grantPermissions: document.getElementById("grant-permissions"),
      feedStatus: document.getElementById("feed-status"),
      feedList: document.getElementById("feed-list"),
      feedEmpty: document.getElementById("feed-empty"),
      feedEmptyTitle: document.getElementById("feed-empty-title"),
      feedEmptyText: document.getElementById("feed-empty-text"),
      feedEmptyAction: document.getElementById("feed-empty-action"),
      loadMore: document.getElementById("load-more"),
      lastUpdated: document.getElementById("last-updated"),
    },
  });

  settingsView = initSettingsView(app);

  await app.reload();

  tabs = initTabs({
    tabs: tabElements,
    panels: panelElements,
    initialId: app.data.settings.ui.activeTab,
    onChange: (activeTab) => {
      if (app.data.settings.ui.activeTab !== activeTab) {
        void app.updateUi({ activeTab });
      }
    },
  });

  feedView.render();
  settingsView.render();

  document.getElementById("refresh-button").addEventListener("click", () => {
    void app.refresh({ manual: true });
  });

  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "feed-updated") {
      return undefined;
    }

    app
      .reload()
      .then(() => {
        if (message.error) {
          showToast(message.error, { error: true });
        } else if (message.reason === "alarm") {
          showToast("Feed refreshed in the background.");
        }
      })
      .catch(() => {
        showToast("Could not reload the feed.", { error: true });
      });

    return undefined;
  });

  browser.permissions.onRemoved.addListener((permissions) => {
    if (permissions.origins?.length) {
      showToast("Host access was removed. Some sources need access again.", { error: true });
      void app.reload();
    }
  });

  void maybeRefresh();
}

async function maybeRefresh() {
  if (!app.data) {
    return;
  }

  if (!app.data.subscriptions.some((subscription) => subscription.enabled)) {
    return;
  }

  const lastCompleted = Date.parse(app.data.refreshState.lastCompletedAt || "") || 0;
  const ttlMinutes = Number(app.data.settings.feed.cacheTtlMinutes) || 15;
  const stale = Date.now() - lastCompleted > ttlMinutes * 60 * 1000;

  if (stale) {
    await app.refresh();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void start(), { once: true });
} else {
  void start();
}
