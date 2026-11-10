/** Domain model shared by the background script, the sidebar, and tests. */

export type PlatformId =
  | "youtube"
  | "peertube"
  | "odysee"
  | "rutube"
  | "dailymotion"
  | "dtube"
  | "pixabay"
  | "twitch"
  | "goodgame"
  | "vkvideo"
  | "bilibili"
  | "rumble"
  | "generic";

/** `native` platforms have a built-in adapter; `bridge`/`generic` need a feed URL. */
export type PlatformKind = "native" | "bridge" | "generic";

export type InstanceKind = "peertube" | "rsshub" | "vk" | "bilibili" | "rumble" | "generic";

export interface Subscription {
  platform: PlatformId;
  instanceUrl: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  feedUrl: string;
  enabled: boolean;
}

/** Loosely shaped input from forms and import files, normalized by `normalizeSubscription`. */
export type RawSubscription = Readonly<Record<string, unknown>>;

export interface FeedItem {
  id: string;
  platform: PlatformId;
  channelId: string;
  channelName: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export type CacheErrorCode = "" | "permission-required" | "fetch-failed";

export interface CacheEntry {
  fetchedAt: string;
  items: FeedItem[];
  error: string;
  errorCode: CacheErrorCode;
}

/** Cache entries keyed by `subscriptionKey`. */
export type FeedCache = Record<string, CacheEntry>;

export interface Instance {
  id: string;
  kind: InstanceKind;
  label: string;
  url: string;
}

export interface RefreshSettings {
  intervalMinutes: number;
  enabled: boolean;
}

export interface FeedSettings {
  cacheTtlMinutes: number;
  itemsPerSource: number;
  concurrency: number;
  timeoutMs: number;
}

export type TabId = "feed" | "settings";

/** Sentinel filter value meaning "no filter". */
export const ALL = "all";

export interface UiSettings {
  activeTab: TabId;
  /** `"all"` or a `PlatformId`. */
  platformFilter: string;
  /** `"all"` or a subscription key. */
  channelFilter: string;
}

/** Personal API keys for platforms that require one. Stored locally, never exported. */
export interface ApiKeys {
  pixabay: string;
  /** Client ID of a Twitch application registered at dev.twitch.tv. */
  twitchClientId: string;
  /** User access token from "Sign in with Twitch"; empty when signed out. */
  twitchToken: string;
  /** Twitch login the token belongs to, shown in Settings. */
  twitchLogin: string;
}

export interface Settings {
  instances: Instance[];
  refresh: RefreshSettings;
  feed: FeedSettings;
  ui: UiSettings;
  apiKeys: ApiKeys;
}

export interface RefreshState {
  running: boolean;
  startedAt: string | null;
  lastCompletedAt: string | null;
}

export interface AppState {
  schemaVersion: number;
  subscriptions: Subscription[];
  settings: Settings;
  cache: FeedCache;
  refreshState: RefreshState;
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  accept?: string;
  /** Extra request headers, e.g. an API's `Authorization`. Never included in error messages. */
  headers?: Readonly<Record<string, string>>;
}

export type FetchText = (url: string, options?: FetchOptions) => Promise<string>;
export type FetchJson = (url: string, options?: FetchOptions) => Promise<unknown>;
export type PostJson = (url: string, body: unknown, options?: FetchOptions) => Promise<unknown>;

export interface AdapterContext {
  fetchText: FetchText;
  fetchJson: FetchJson;
  postJson: PostJson;
  timeoutMs: number;
  itemsPerSource: number;
  apiKeys: Readonly<ApiKeys>;
}

export interface PlatformAdapter {
  fetchItems(subscription: Subscription, context: AdapterContext): Promise<FeedItem[]>;
  /** Public RSS/Atom URL for the subscription, when the platform has one. */
  feedUrlFor?(subscription: Subscription): string;
}
