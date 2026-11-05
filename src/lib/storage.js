export const SCHEMA_VERSION = 1;
export const REFRESH_INTERVAL_DEFAULT = 180;
export const REFRESH_INTERVAL_OPTIONS = [60, 180, 360];

export const DEFAULT_SETTINGS = {
  instances: [],
  refresh: {
    intervalMinutes: REFRESH_INTERVAL_DEFAULT,
    enabled: true,
  },
  feed: {
    cacheTtlMinutes: 15,
    itemsPerSource: 20,
    maxItems: 200,
    concurrency: 4,
    timeoutMs: 15000,
  },
  ui: {
    activeTab: "feed",
    platformFilter: "all",
    channelFilter: "all",
  },
};

export const DEFAULT_REFRESH_STATE = {
  running: false,
  startedAt: null,
  lastCompletedAt: null,
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeSettings(value) {
  const settings = isObject(value) ? value : {};
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    instances: Array.isArray(settings.instances) ? settings.instances : [],
    refresh: {
      ...DEFAULT_SETTINGS.refresh,
      ...(isObject(settings.refresh) ? settings.refresh : {}),
    },
    feed: {
      ...DEFAULT_SETTINGS.feed,
      ...(isObject(settings.feed) ? settings.feed : {}),
    },
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(isObject(settings.ui) ? settings.ui : {}),
    },
  };
}

export function normalizeState(raw) {
  const value = isObject(raw) ? raw : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    subscriptions: Array.isArray(value.subscriptions) ? value.subscriptions : [],
    settings: mergeSettings(value.settings),
    cache: isObject(value.cache) ? value.cache : {},
    refreshState: {
      ...DEFAULT_REFRESH_STATE,
      ...(isObject(value.refreshState) ? value.refreshState : {}),
    },
  };
}

export async function loadState() {
  const raw = await browser.storage.local.get([
    "schemaVersion",
    "subscriptions",
    "settings",
    "cache",
    "refreshState",
  ]);
  return normalizeState(raw);
}

export async function saveSubscriptions(subscriptions) {
  await browser.storage.local.set({
    schemaVersion: SCHEMA_VERSION,
    subscriptions,
  });
}

export async function saveSettings(settings) {
  await browser.storage.local.set({ settings });
}

export async function saveCache(cache) {
  await browser.storage.local.set({ cache });
}

export async function saveRefreshState(refreshState) {
  await browser.storage.local.set({ refreshState });
}

export async function clearCache() {
  await browser.storage.local.set({ cache: {} });
}

export async function resetAll() {
  await browser.storage.local.clear();
  await browser.storage.local.set({
    schemaVersion: SCHEMA_VERSION,
    subscriptions: [],
    settings: DEFAULT_SETTINGS,
    cache: {},
    refreshState: DEFAULT_REFRESH_STATE,
  });
}

export function estimateStorageBytes(state) {
  return new Blob([JSON.stringify(state)]).size;
}
