import { fillSelect, getElement, setText } from "../../lib/dom.js";
import { platformLabel } from "../../lib/platforms/registry.js";
import { subscriptionKey } from "../../lib/subscriptions.js";
import { pluralize } from "../../lib/text.js";
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
        channelName: item.channelName || titleOf(subscription) || "Unknown channel",
      });
    }
  }

  return items.sort(byPublishedDesc);
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

  function renderFilters(subscriptions: readonly Subscription[]): void {
    const { ui } = app.state.settings;
    fillSelect(
      elements.platformFilter,
      withFallback(platformOptions(subscriptions), "All platforms"),
      { selectedValue: ui.platformFilter, fallback: ALL }
    );
    fillSelect(
      elements.channelFilter,
      withFallback(channelOptions(subscriptions, elements.platformFilter.value), "All channels"),
      { selectedValue: ui.channelFilter, fallback: ALL }
    );
  }

  function renderStatus(entries: readonly CacheEntry[]): void {
    const { subscriptions, refreshState } = app.state;
    const failures = entries.filter((entry) => entry.error).length;

    let status = "";
    if (app.refreshing) {
      status = "Refreshing feeds…";
    } else if (failures > 0) {
      status = `${pluralize(failures, "source")} could not be refreshed.`;
    } else if (subscriptions.length > 0 && !refreshState.lastCompletedAt) {
      status = "Feed has not been refreshed yet.";
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
        `Access is needed for ${pluralize(permissionErrors.length, "source")}. Grant access to load the full feed.`
      );
    } else if (errors[0]) {
      setText(elements.feedErrorText, errors[0].error);
    }
  }

  function emptyStateFor(hasSubscriptions: boolean, hasItems: boolean): EmptyState | null {
    if (!hasSubscriptions) {
      return {
        action: "settings",
        title: "No subscriptions yet",
        text: "Add a channel or import a subscription file.",
        button: "Open settings",
      };
    }
    if (!hasItems) {
      return {
        action: "refresh",
        title: app.refreshing ? "Refreshing feeds" : "No videos yet",
        text: app.refreshing
          ? "Your subscriptions are being checked for new videos."
          : "Fetch the latest videos from your subscriptions.",
        button: "Fetch now",
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
        `Load ${Math.min(PAGE_SIZE, remaining)} more (${remaining} remaining)`
      );
    }
  }

  function render(): void {
    const { subscriptions, cache } = app.state;
    const entries = Object.values(cache);

    renderFilters(subscriptions);
    renderStatus(entries);
    renderErrors(entries);

    const allItems = flattenItems(cache, subscriptions);
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
            title: "No matching videos",
            text: "Try another platform or channel filter.",
            button: "Clear filters",
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
    setText(button, "Requesting…");

    try {
      if (await app.requestPermissions()) {
        showToast("Access granted. Refreshing feeds.");
        await app.refresh({ manual: true });
      } else {
        showError("Access was not granted. Some sources will stay unavailable.");
      }
    } catch {
      showError("Could not request access.");
    } finally {
      button.disabled = false;
      setText(button, "Grant access");
    }
  }

  elements.grantPermissions.addEventListener("click", () => void grantPermissions());

  return { render };
}
