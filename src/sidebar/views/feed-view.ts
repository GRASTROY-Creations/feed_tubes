import { fillSelect, getElement, setText } from "../../lib/dom.js";
import { platformLabel } from "../../lib/platforms/registry.js";
import { subscriptionKey } from "../../lib/subscriptions.js";
import { byPublishedDesc, formatLastUpdated } from "../../lib/time.js";
import {
  ALL,
  type CacheEntry,
  type FeedCache,
  type FeedItem,
  type Subscription,
} from "../../lib/types.js";
import type { AppContext, View } from "../app-context.js";
import { showError, showToast } from "../components/toast.js";
import { createVideoCard } from "../components/video-card.js";
import { currentLanguage, t, translate } from "../../lib/i18n/index.js";

/** Videos shown at first, and added by each click on "Load more". */
const PAGE_SIZE = 30;

type EmptyAction = "settings" | "refresh" | "filters";

interface FeedEntry extends FeedItem {
  /** Subscription key of the cache entry the item came from. */
  sourceKey: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface EmptyState {
  action: EmptyAction;
  title: string;
  text: string;
  button: string;
}

function titleOf(subscription: Subscription | undefined): string {
  return subscription?.channelName || subscription?.channelId || subscription?.feedUrl || "";
}

function byLabel(left: SelectOption, right: SelectOption): number {
  return left.label.localeCompare(right.label);
}

function platformOptions(subscriptions: readonly Subscription[]): SelectOption[] {
  const platforms = new Set(subscriptions.map((subscription) => subscription.platform));
  return [...platforms]
    .map((platform) => ({ value: platform, label: platformLabel(platform) }))
    .sort(byLabel);
}

function channelOptions(subscriptions: readonly Subscription[], platform: string): SelectOption[] {
  return subscriptions
    .filter((subscription) => platform === ALL || subscription.platform === platform)
    .map((subscription) => ({ value: subscriptionKey(subscription), label: titleOf(subscription) }))
    .sort(byLabel);
}

/** All cached items across sources, deduplicated and newest first. */
function flattenItems(cache: FeedCache, subscriptions: readonly Subscription[]): FeedEntry[] {
  const subscriptionsByKey = new Map(
    subscriptions.map((subscription) => [subscriptionKey(subscription), subscription])
  );
  const seen = new Set<string>();
  const items: FeedEntry[] = [];

  for (const [key, entry] of Object.entries(cache)) {
    const subscription = subscriptionsByKey.get(key);
    for (const item of entry.items) {
      const dedupeKey = `${item.platform}|${item.id}|${item.url}`;
      if (!item.url || seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      items.push({
        ...item,
        sourceKey: key,
        channelName: item.channelName || titleOf(subscription) || t("card-unknown-channel"),
      });
    }
  }

  return items.sort(byPublishedDesc);
}

/** Returns a check that is true when `keys` differ (by identity) from the previous call. */
function changeTracker(): (keys: readonly unknown[]) => boolean {
  let previous: readonly unknown[] | null = null;
  return (keys) => {
    const changed =
      previous?.length !== keys.length || keys.some((value, index) => value !== previous?.[index]);
    previous = keys;
    return changed;
  };
}

/** Remembers the last result: `compute` runs only when one of `keys` changed. */
function lastResult<R>(): (keys: readonly unknown[], compute: () => R) => R {
  const changed = changeTracker();
  let result: R | undefined;
  return (keys, compute) => {
    if (changed(keys) || result === undefined) {
      result = compute();
    }
    return result;
  };
}

function withFallback(options: readonly SelectOption[], allLabel: string): SelectOption[] {
  return [{ value: ALL, label: allLabel }, ...options];
}

export function initFeedView(app: AppContext): View {
  const elements = {
    platformFilter: getElement("platform-filter", HTMLSelectElement),
    channelFilter: getElement("channel-filter", HTMLSelectElement),
    feedError: getElement("feed-error", HTMLDivElement),
    feedErrorText: getElement("feed-error-text", HTMLSpanElement),
    grantPermissions: getElement("grant-permissions", HTMLButtonElement),
    feedStatus: getElement("feed-status", HTMLParagraphElement),
    feedList: getElement("feed-list", HTMLDivElement),
    feedEmpty: getElement("feed-empty", HTMLDivElement),
    feedEmptyTitle: getElement("feed-empty-title", HTMLHeadingElement),
    feedEmptyText: getElement("feed-empty-text", HTMLParagraphElement),
    feedEmptyAction: getElement("feed-empty-action", HTMLButtonElement),
    loadMore: getElement("load-more", HTMLButtonElement),
    lastUpdated: getElement("last-updated", HTMLParagraphElement),
  };

  let visibleCount = PAGE_SIZE;
  let emptyAction: EmptyAction = "settings";

  // With thousands of subscriptions, the filters and the merged item list are expensive.
  // Both are rebuilt only when what they are built from changes (a reload replaces the
  // stored objects), not on every render. Translated labels are part of the results, so the
  // language is part of every key.
  const platformChoices = lastResult<SelectOption[]>();
  const channelChoices = lastResult<SelectOption[]>();
  const feedItems = lastResult<FeedEntry[]>();
  // Filling a `<select>` is skipped when its options and selection are unchanged.
  const platformFilterChanged = changeTracker();
  const channelFilterChanged = changeTracker();

  function renderFilters(subscriptions: readonly Subscription[]): void {
    const { ui } = app.state.settings;
    const language = currentLanguage();

    const platforms = platformChoices([subscriptions, language], () =>
      withFallback(platformOptions(subscriptions), t("common-all-platforms"))
    );
    if (platformFilterChanged([platforms, ui.platformFilter])) {
      fillSelect(elements.platformFilter, platforms, {
        selectedValue: ui.platformFilter,
        fallback: ALL,
      });
    }

    // The platform select falls back to "all" when the stored platform has no subscriptions.
    const platform = elements.platformFilter.value || ALL;
    const channels = channelChoices([subscriptions, platform, language], () =>
      withFallback(channelOptions(subscriptions, platform), t("common-all-channels"))
    );
    if (channelFilterChanged([channels, ui.channelFilter])) {
      fillSelect(elements.channelFilter, channels, {
        selectedValue: ui.channelFilter,
        fallback: ALL,
      });
    }
  }

  function renderStatus(entries: readonly CacheEntry[]): void {
    const { subscriptions, refreshState } = app.state;
    const failures = entries.filter((entry) => entry.error).length;

    let status = "";
    if (app.refreshing || refreshState.running) {
      status = t("feed-status-refreshing");
    } else if (refreshState.pending > 0) {
      status = t("feed-status-queued", { count: refreshState.pending });
    } else if (failures > 0) {
      status = t("feed-status-failures", { count: failures });
    } else if (subscriptions.length > 0 && !refreshState.lastCompletedAt) {
      status = t("feed-status-never-refreshed");
    }

    setText(elements.feedStatus, status);
    setText(elements.lastUpdated, formatLastUpdated(refreshState.lastCompletedAt));
  }

  function renderErrors(entries: readonly CacheEntry[]): void {
    const errors = entries.filter((entry) => entry.error);
    const permissionErrors = errors.filter((entry) => entry.errorCode === "permission-required");

    elements.feedError.hidden = errors.length === 0;
    elements.grantPermissions.hidden = permissionErrors.length === 0;

    if (permissionErrors.length > 0) {
      setText(
        elements.feedErrorText,
        t("feed-error-permissions", { count: permissionErrors.length })
      );
    } else if (errors[0]?.error) {
      // Stored as a message id, so it follows a language change without a new fetch.
      setText(elements.feedErrorText, translate(errors[0].error));
    }
  }

  function emptyStateFor(hasSubscriptions: boolean, hasItems: boolean): EmptyState | null {
    if (!hasSubscriptions) {
      return {
        action: "settings",
        title: t("feed-empty-no-subscriptions-title"),
        text: t("feed-empty-no-subscriptions-text"),
        button: t("feed-empty-no-subscriptions-button"),
      };
    }
    if (!hasItems) {
      return {
        action: "refresh",
        title: app.refreshing ? t("feed-empty-refreshing-title") : t("feed-empty-no-videos-title"),
        text: app.refreshing ? t("feed-empty-refreshing-text") : t("feed-empty-no-videos-text"),
        button: t("feed-empty-no-videos-button"),
      };
    }
    return null;
  }

  function renderEmpty(state: EmptyState | null): void {
    elements.feedEmpty.hidden = state === null;
    if (state) {
      emptyAction = state.action;
      setText(elements.feedEmptyTitle, state.title);
      setText(elements.feedEmptyText, state.text);
      setText(elements.feedEmptyAction, state.button);
    }
    elements.feedEmptyAction.disabled = app.refreshing && emptyAction === "refresh";
  }

  /** Shows the first `visibleCount` items; "Load more" reveals the next page. */
  function renderList(items: readonly FeedEntry[]): void {
    const visibleItems = items.slice(0, visibleCount);

    elements.feedList.replaceChildren(
      ...visibleItems.map(createVideoCard).filter((card) => card !== null)
    );

    const remaining = items.length - visibleItems.length;
    elements.loadMore.hidden = remaining <= 0;
    if (remaining > 0) {
      setText(
        elements.loadMore,
        t("feed-load-more-count", { count: Math.min(PAGE_SIZE, remaining), remaining })
      );
    }
  }

  function render(): void {
    const { subscriptions, cache } = app.state;
    const entries = Object.values(cache);

    renderFilters(subscriptions);
    renderStatus(entries);
    renderErrors(entries);

    const allItems = feedItems([cache, subscriptions, currentLanguage()], () =>
      flattenItems(cache, subscriptions)
    );
    const platformFilter = elements.platformFilter.value || ALL;
    const channelFilter = elements.channelFilter.value || ALL;
    const filteredItems = allItems.filter(
      (item) =>
        (platformFilter === ALL || item.platform === platformFilter) &&
        (channelFilter === ALL || item.sourceKey === channelFilter)
    );

    renderList(filteredItems);

    const emptyState =
      emptyStateFor(subscriptions.length > 0, allItems.length > 0) ??
      (filteredItems.length === 0
        ? {
            action: "filters" as const,
            title: t("feed-empty-no-matches-title"),
            text: t("feed-empty-no-matches-text"),
            button: t("feed-empty-no-matches-button"),
          }
        : null);
    renderEmpty(emptyState);
  }

  function resetPaging(): void {
    visibleCount = PAGE_SIZE;
  }

  elements.platformFilter.addEventListener("change", () => {
    resetPaging();
    void app.updateUi({ platformFilter: elements.platformFilter.value, channelFilter: ALL });
  });

  elements.channelFilter.addEventListener("change", () => {
    resetPaging();
    void app.updateUi({ channelFilter: elements.channelFilter.value });
  });

  elements.loadMore.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  elements.feedEmptyAction.addEventListener("click", () => {
    switch (emptyAction) {
      case "settings":
        app.openSettings();
        break;
      case "filters":
        resetPaging();
        void app.updateUi({ platformFilter: ALL, channelFilter: ALL });
        break;
      case "refresh":
        void app.refresh({ manual: true });
        break;
    }
  });

  async function grantPermissions(): Promise<void> {
    const button = elements.grantPermissions;
    button.disabled = true;
    setText(button, t("feed-requesting"));

    try {
      if (await app.requestPermissions()) {
        showToast(t("feed-toast-access-granted"));
        await app.refresh({ manual: true });
      } else {
        showError(t("feed-toast-access-denied"));
      }
    } catch {
      showError(t("feed-toast-access-failed"));
    } finally {
      button.disabled = false;
      setText(button, t("feed-grant-access"));
    }
  }

  elements.grantPermissions.addEventListener("click", () => void grantPermissions());

  return { render };
}
