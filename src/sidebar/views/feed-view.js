import { createEl, clearElement, setHidden, setText } from "../../lib/dom.js";
import { platformLabel } from "../../lib/platforms/registry.js";
import { subscriptionKey } from "../../lib/subscriptions.js";
import { formatLastUpdated } from "../../lib/time.js";
import { createVideoCard } from "../components/video-card.js";
import { showToast } from "../components/toast.js";

const PAGE_SIZE = 60;

function titleOf(subscription) {
  return subscription.channelName || subscription.channelId || subscription.feedUrl;
}

function platformOptions(subscriptions) {
  const platforms = [...new Set(subscriptions.map((subscription) => subscription.platform))];
  return platforms
    .map((platform) => ({ value: platform, label: platformLabel(platform) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function channelOptions(subscriptions, platform) {
  const matching = subscriptions.filter(
    (subscription) => platform === "all" || subscription.platform === platform
  );
  return matching
    .map((subscription) => ({
      value: subscriptionKey(subscription),
      label: titleOf(subscription),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function fillSelect(select, options, selectedValue, allLabel) {
  const previousValue = select.value;
  const targetValue =
    selectedValue === undefined || selectedValue === null ? previousValue : selectedValue;
  clearElement(select);

  if (allLabel) {
    select.append(
      createEl("option", {
        text: allLabel,
        attrs: { value: "all" },
      })
    );
  }

  for (const option of options) {
    select.append(
      createEl("option", {
        text: option.label,
        attrs: { value: option.value },
      })
    );
  }

  const hasTarget = Array.from(select.options).some((option) => option.value === targetValue);
  select.value = hasTarget ? targetValue : "all";
}

function flattenItems(cache, subscriptionsByKey) {
  const seen = new Set();
  const items = [];

  for (const [key, entry] of Object.entries(cache || {})) {
    if (!Array.isArray(entry?.items)) {
      continue;
    }

    const subscription = subscriptionsByKey.get(key);
    for (const item of entry.items) {
      if (!item || !item.url) {
        continue;
      }
      const dedupeKey = `${item.platform || ""}|${item.id || ""}|${item.url}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      items.push({
        ...item,
        sourceKey: key,
        platform: item.platform || subscription?.platform || "generic",
        channelName: item.channelName || titleOf(subscription || {}) || "Unknown channel",
      });
    }
  }

  return items.sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt || "") || 0;
    const rightTime = Date.parse(right.publishedAt || "") || 0;
    return rightTime - leftTime;
  });
}

export function initFeedView({ app, elements }) {
  let visibleCount = PAGE_SIZE;
  let emptyAction = "settings";

  function subscriptionsByKey() {
    return new Map(
      app.data.subscriptions.map((subscription) => [subscriptionKey(subscription), subscription])
    );
  }

  function renderFilters(subscriptions) {
    const ui = app.data.settings.ui;
    const platform = subscriptions.some(
      (subscription) => subscription.platform === ui.platformFilter
    )
      ? ui.platformFilter
      : "all";

    fillSelect(elements.platformFilter, platformOptions(subscriptions), platform, "All platforms");

    const channels = channelOptions(subscriptions, platform);
    const channel = channels.some((option) => option.value === ui.channelFilter)
      ? ui.channelFilter
      : "all";
    fillSelect(elements.channelFilter, channels, channel, "All channels");
  }

  function renderStatus(entries) {
    const failures = entries.filter((entry) => entry.error).length;

    if (app.refreshing) {
      setText(elements.feedStatus, "Refreshing feeds…");
    } else if (failures > 0) {
      setText(
        elements.feedStatus,
        `${failures} source${failures === 1 ? "" : "s"} could not be refreshed.`
      );
    } else if (app.data.subscriptions.length === 0) {
      setText(elements.feedStatus, "");
    } else if (!app.data.refreshState.lastCompletedAt) {
      setText(elements.feedStatus, "Feed has not been refreshed yet.");
    } else {
      setText(elements.feedStatus, "");
    }

    setText(elements.lastUpdated, formatLastUpdated(app.data.refreshState.lastCompletedAt));
  }

  function renderErrors(entries) {
    const errors = entries.filter((entry) => entry.error);
    const permissionErrors = errors.filter((entry) => entry.errorCode === "permission-required");

    if (errors.length === 0) {
      setHidden(elements.feedError, true);
      setHidden(elements.grantPermissions, true);
      return;
    }

    setHidden(elements.feedError, false);
    setHidden(elements.grantPermissions, permissionErrors.length === 0);

    if (permissionErrors.length > 0) {
      setText(
        elements.feedErrorText,
        `Access is needed for ${permissionErrors.length} source${
          permissionErrors.length === 1 ? "" : "s"
        }. Grant access to load the full feed.`
      );
    } else {
      const first = errors[0];
      setText(
        elements.feedErrorText,
        first.error || "Some sources could not be refreshed. Cached items are shown."
      );
    }
  }

  function renderEmpty({ subscriptions, allItems, filteredItems }) {
    let visible = false;
    let title = "";
    let text = "";

    if (subscriptions.length === 0) {
      visible = true;
      emptyAction = "settings";
      title = "No subscriptions yet";
      text = "Add a channel or import a subscription file to get started.";
      setText(elements.feedEmptyAction, "Open settings");
    } else if (allItems.length === 0) {
      visible = true;
      emptyAction = "refresh";
      title = app.refreshing ? "Refreshing feeds" : "No videos yet";
      text = app.refreshing
        ? "Your subscriptions are being checked for new videos."
        : "Refresh to fetch the latest videos from your subscriptions.";
      setText(elements.feedEmptyAction, "Refresh now");
    } else if (filteredItems.length === 0) {
      visible = true;
      emptyAction = "filters";
      title = "No matching videos";
      text = "Try another platform or channel filter.";
      setText(elements.feedEmptyAction, "Clear filters");
    }

    setHidden(elements.feedEmpty, !visible);
    setText(elements.feedEmptyTitle, title);
    setText(elements.feedEmptyText, text);
    elements.feedEmptyAction.disabled = app.refreshing && emptyAction === "refresh";
  }

  function render() {
    if (!app.data) {
      return;
    }

    const subscriptions = app.data.subscriptions;
    const byKey = subscriptionsByKey();
    const entries = Object.entries(app.data.cache || {}).map(([key, entry]) => ({
      key,
      ...entry,
    }));

    renderFilters(subscriptions);
    renderStatus(entries);
    renderErrors(entries);

    const allItems = flattenItems(app.data.cache, byKey);
    const platformFilter = elements.platformFilter.value || "all";
    const channelFilter = elements.channelFilter.value || "all";

    const filteredItems = allItems.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) {
        return false;
      }
      if (channelFilter !== "all" && item.sourceKey !== channelFilter) {
        return false;
      }
      return true;
    });

    const maxItems = Math.min(Number(app.data.settings.feed.maxItems) || 200, filteredItems.length);
    const visibleItems = filteredItems.slice(0, Math.min(visibleCount, maxItems));

    clearElement(elements.feedList);
    for (const item of visibleItems) {
      const card = createVideoCard(item);
      if (card) {
        elements.feedList.append(card);
      }
    }

    renderEmpty({ subscriptions, allItems, filteredItems });

    const hasMore = filteredItems.length > visibleItems.length && visibleItems.length < maxItems;
    setHidden(elements.loadMore, !hasMore);
    if (hasMore) {
      setText(
        elements.loadMore,
        `Show more (${filteredItems.length - visibleItems.length} remaining)`
      );
    }
  }

  function openSettings() {
    app.openSettings();
  }

  elements.platformFilter.addEventListener("change", () => {
    visibleCount = PAGE_SIZE;
    void app.updateUi({
      platformFilter: elements.platformFilter.value,
      channelFilter: "all",
    });
  });

  elements.channelFilter.addEventListener("change", () => {
    visibleCount = PAGE_SIZE;
    void app.updateUi({ channelFilter: elements.channelFilter.value });
  });

  elements.loadMore.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  elements.feedEmptyAction.addEventListener("click", () => {
    if (emptyAction === "settings") {
      openSettings();
      return;
    }

    if (emptyAction === "filters") {
      visibleCount = PAGE_SIZE;
      void app.updateUi({ platformFilter: "all", channelFilter: "all" });
      return;
    }

    void app.refresh({ manual: true });
  });

  elements.grantPermissions.addEventListener("click", async () => {
    elements.grantPermissions.disabled = true;
    setText(elements.grantPermissions, "Requesting…");

    try {
      const granted = await app.requestPermissions();
      if (granted) {
        showToast("Access granted. Refreshing feeds.");
        await app.refresh({ manual: true });
      } else {
        showToast("Access was not granted. Some sources will stay unavailable.", {
          error: true,
        });
      }
    } catch {
      showToast("Could not request access.", { error: true });
    } finally {
      elements.grantPermissions.disabled = false;
      setText(elements.grantPermissions, "Grant access");
    }
  });

  return { render };
}
