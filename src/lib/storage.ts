import { asArray, asRecord, isRecord } from "./guards.js";
import { normalizeLanguageSetting } from "./i18n/index.js";
import type { AppState, FeedCache, RefreshState, Settings, Subscription } from "./types.js";

/**
 * Version 2: cached errors are message ids instead of translated text, and stream cards carry
 * a `stream` flag instead of a translated title prefix.
 */
export const SCHEMA_VERSION = 2;
export const REFRESH_INTERVAL_DEFAULT = 180;
export const REFRESH_INTERVAL_OPTIONS: readonly number[] = [60, 180, 360];

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  instances: [],
  refresh: Object.freeze({
    intervalMinutes: REFRESH_INTERVAL_DEFAULT,
    enabled: true,
  }),
  feed: Object.freeze({
    cacheTtlMinutes: 15,
    itemsPerSource: 20,
    concurrency: 4,
    timeoutMs: 15_000,
  }),
  ui: Object.freeze({
    activeTab: "feed",
    platformFilter: "all",
    channelFilter: "all",
    language: "auto",
  }),
  apiKeys: Object.freeze({
    pixabay: "",
    twitchClientId: "",
    twitchToken: "",
    twitchLogin: "",
  }),
});

export const DEFAULT_REFRESH_STATE: Readonly<RefreshState> = Object.freeze({
  running: false,
  startedAt: null,
  lastCompletedAt: null,
});

const STATE_KEYS = ["schemaVersion", "subscriptions", "settings", "cache", "refreshState"] as const;

/** Fresh, mutable copy of the defaults, so stored state never aliases the constants. */
export function defaultSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}

function mergeSettings(value: unknown): Settings {
  const stored = asRecord(value);
  const defaults = defaultSettings();
  return {
    ...defaults,
    instances: asArray(stored.instances) as Settings["instances"],
    refresh: { ...defaults.refresh, ...asRecord(stored.refresh) },
    feed: { ...defaults.feed, ...asRecord(stored.feed) },
    ui: {
      ...defaults.ui,
      ...asRecord(stored.ui),
      language: normalizeLanguageSetting(asRecord(stored.ui).language),
    },
    apiKeys: { ...defaults.apiKeys, ...asRecord(stored.apiKeys) },
  };
}

/** Turns whatever is in storage into a complete `AppState`, filling in defaults. */
export function normalizeState(raw: unknown): AppState {
  const value = asRecord(raw);
  return {
    schemaVersion: SCHEMA_VERSION,
    subscriptions: asArray(value.subscriptions) as Subscription[],
    settings: mergeSettings(value.settings),
    // Older caches hold text in the language of the time; they refetch on their own.
    cache: (isRecord(value.cache) && value.schemaVersion === SCHEMA_VERSION
      ? value.cache
      : {}) as FeedCache,
    refreshState: { ...DEFAULT_REFRESH_STATE, ...asRecord(value.refreshState) },
  };
}

export async function loadState(): Promise<AppState> {
  return normalizeState(await browser.storage.local.get([...STATE_KEYS]));
}

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  await browser.storage.local.set({ schemaVersion: SCHEMA_VERSION, subscriptions });
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ settings });
}

export async function saveCache(cache: FeedCache): Promise<void> {
  // The version marks the cache format, so it is written with every cache.
  await browser.storage.local.set({ schemaVersion: SCHEMA_VERSION, cache });
}

export async function saveRefreshState(refreshState: RefreshState): Promise<void> {
  await browser.storage.local.set({ refreshState });
}

export async function clearCache(): Promise<void> {
  await saveCache({});
}

export async function resetAll(): Promise<void> {
  await browser.storage.local.clear();
  await browser.storage.local.set({
    schemaVersion: SCHEMA_VERSION,
    subscriptions: [],
    settings: defaultSettings(),
    cache: {},
    refreshState: { ...DEFAULT_REFRESH_STATE },
  });
}

export function estimateStorageBytes(state: AppState): number {
  return new Blob([JSON.stringify(state)]).size;
}
