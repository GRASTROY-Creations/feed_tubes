import type { AppState, Settings, Subscription, UiSettings } from "../lib/types.js";

/** What the sidebar views may read and do; implemented by `App` in sidebar.ts. */
export interface AppContext {
  /** Current stored state. */
  readonly state: AppState;
  /** True while a refresh requested by this sidebar is running. */
  readonly refreshing: boolean;

  persistSettings(settings: Settings): Promise<void>;
  persistSubscriptions(subscriptions: Subscription[]): Promise<void>;
  updateUi(partial: Partial<UiSettings>): Promise<void>;
  openSettings(): void;
  /** Requests host access for every enabled subscription. */
  requestPermissions(): Promise<boolean>;
  refresh(options?: { manual?: boolean }): Promise<void>;
  clearCache(): Promise<void>;
  resetAll(): Promise<void>;
}

export interface View {
  render(): void;
}
