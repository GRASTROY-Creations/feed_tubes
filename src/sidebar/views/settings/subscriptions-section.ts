import { createEl, createOption, getElement, setMessage, setText } from "../../../lib/dom.js";
import { errorMessage, LocalizedError } from "../../../lib/errors.js";
import { fetchText, postJson } from "../../../lib/fetch.js";
import { requestOrigins } from "../../../lib/permissions.js";
import {
  compatibleInstanceKinds,
  getPlatform,
  isPlatformId,
  channelPlaceholder,
  instanceKindLabel,
  platformLabel,
  PLATFORMS,
} from "../../../lib/platforms/registry.js";
import { needsYouTubeLookup } from "../../../lib/platforms/youtube-urls.js";
import { resolveYouTubeChannel } from "../../../lib/platforms/youtube.js";
import { normalizeSubscription, subscriptionKey } from "../../../lib/subscriptions.js";
import {
  ALL,
  type Instance,
  type PlatformId,
  type RawSubscription,
  type Subscription,
} from "../../../lib/types.js";
import { parseHttpUrl } from "../../../lib/url.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import { instanceLabel } from "./instances-section.js";
import {
  fillPlatformOptions,
  fitListToRows,
  hintParagraph,
  listRow,
  submitButtonOf,
  withDisabled,
  type SettingsSection,
} from "./shared.js";
import { currentLanguage, t } from "../../../lib/i18n/index.js";

const DEFAULT_PLATFORM: PlatformId = "youtube";
/** Rows shown at first, and added by each click on "Show more". */
const LIST_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 150;

export function initSubscriptionsSection(app: AppContext): SettingsSection {
  const elements = {
    search: getElement("subscription-search", HTMLInputElement),
    filter: getElement("subscription-filter", HTMLSelectElement),
    list: getElement("subscription-list", HTMLDivElement),
    section: getElement("settings-subscriptions", HTMLDetailsElement),
    form: getElement("subscription-form", HTMLFormElement),
    platform: getElement("subscription-platform", HTMLSelectElement),
    instanceRow: getElement("subscription-instance-row", HTMLLabelElement),
    instance: getElement("subscription-instance", HTMLSelectElement),
    channel: getElement("subscription-channel", HTMLInputElement),
    alias: getElement("subscription-alias", HTMLInputElement),
    feedRow: getElement("subscription-feed-row", HTMLLabelElement),
    feedUrl: getElement("subscription-feed-url", HTMLInputElement),
    feedRowLabel: getElement("subscription-feed-label", HTMLSpanElement),
    cancel: getElement("subscription-cancel", HTMLButtonElement),
    error: getElement("subscription-error", HTMLParagraphElement),
    enableAll: getElement("enable-all", HTMLButtonElement),
    disableAll: getElement("disable-all", HTMLButtonElement),
    deleteDisabled: getElement("delete-disabled", HTMLButtonElement),
  };
  const submit = submitButtonOf(elements.form);

  let editingKey: string | null = null;
  let visibleCount = LIST_PAGE_SIZE;
  /** What the list was last built from; see `renderList`. */
  let lastListInputs: readonly unknown[] | null = null;

  const subscriptions = (): Subscription[] => app.state.subscriptions;
  /** The subscription loaded into the form by "Edit", if any. */
  const editedSubscription = (): Subscription | undefined =>
    editingKey === null
      ? undefined
      : subscriptions().find((subscription) => subscriptionKey(subscription) === editingKey);
  const selectedPlatformId = (): PlatformId =>
    isPlatformId(elements.platform.value) ? elements.platform.value : DEFAULT_PLATFORM;
  const selectedPlatform = () => getPlatform(selectedPlatformId());

  // --- Instance picker -------------------------------------------------------

  function instancesForPlatform(): Instance[] {
    const { instanceKind } = selectedPlatform();
    if (!instanceKind) {
      return [];
    }
    const kinds = compatibleInstanceKinds(instanceKind);
    return app.state.settings.instances.filter((instance) => kinds.includes(instance.kind));
  }

  function renderInstanceOptions(): void {
    const { instanceKind } = selectedPlatform();
    elements.instanceRow.hidden = !instanceKind;
    if (!instanceKind) {
      elements.instance.replaceChildren();
      return;
    }

    const previous = elements.instance.value;
    const options = instancesForPlatform();

    elements.instance.replaceChildren(
      ...(instanceKind === "peertube" ? [] : [createOption("", t("subs-no-instance"))]),
      ...options.map((instance) => createOption(instance.url, instanceLabel(instance))),
      ...(options.length === 0
        ? [
            createOption(
              "",
              t("subs-add-instance-hint", { kind: instanceKindLabel(instanceKind) }),
              true
            ),
          ]
        : [])
    );

    const values = Array.from(elements.instance.options, (option) => option.value);
    elements.instance.value =
      previous && values.includes(previous) ? previous : (options[0]?.url ?? "");
  }

  function updateForm(): void {
    const platform = selectedPlatform();
    const needsFeed = platform.requiresFeedUrl;
    // Twitch: an RSS bridge feed URL may be used instead of signing in.
    const offersFeed = needsFeed || Boolean(platform.allowsFeedUrl);

    elements.feedRow.hidden = !offersFeed;
    setText(elements.feedRowLabel, needsFeed ? t("subs-feed-url") : t("subs-bridge-feed-url"));
    elements.feedUrl.required = needsFeed;
    elements.channel.required = !needsFeed;
    elements.channel.disabled = needsFeed;
    elements.channel.placeholder = channelPlaceholder(selectedPlatformId());
    if (needsFeed) {
      elements.channel.value = "";
    }
    renderInstanceOptions();
  }

  // --- List ------------------------------------------------------------------

  async function saveSubscriptions(next: Subscription[]): Promise<void> {
    await app.persistSubscriptions(next);
  }

  function startEditing(subscription: Subscription): void {
    editingKey = subscriptionKey(subscription);
    elements.platform.value = subscription.platform;
    updateForm();
    elements.instance.value = subscription.instanceUrl || elements.instance.value;
    elements.channel.value = subscription.channelId || subscription.channelUrl;
    elements.alias.value = subscription.channelName;
    elements.feedUrl.value = subscription.feedUrl;
    setText(submit, t("common-save"));
    elements.cancel.hidden = false;
    setMessage(elements.error, "");
    elements.form.scrollIntoView({ block: "nearest" });
    elements.channel.focus();
  }

  function subscriptionRow(subscription: Subscription): HTMLDivElement {
    const key = subscriptionKey(subscription);

    const toggle = createEl("input", {
      className: "list-item__toggle",
      attrs: {
        type: "checkbox",
        "aria-label": t("subs-toggle-label", { name: subscription.channelName }),
      },
      props: { checked: subscription.enabled },
    });
    toggle.addEventListener("change", () => {
      void saveSubscriptions(
        subscriptions().map((value) =>
          subscriptionKey(value) === key ? { ...value, enabled: toggle.checked } : value
        )
      );
    });

    const detail = subscription.channelId || subscription.feedUrl || subscription.channelUrl;
    return listRow({
      leading: toggle,
      title: subscription.channelName || subscription.channelId || t("subs-fallback-title"),
      meta: `${platformLabel(subscription.platform)} · ${detail}`,
      onEdit: () => {
        startEditing(subscription);
      },
      removeLabel: t("common-delete"),
      onRemove: () => {
        void (async () => {
          await saveSubscriptions(
            subscriptions().filter((value) => subscriptionKey(value) !== key)
          );
          if (editingKey === key) {
            reset();
          }
          showToast(t("subs-deleted"));
        })();
      },
    });
  }

  function matchesFilters(subscription: Subscription, search: string, platform: string): boolean {
    if (platform !== ALL && subscription.platform !== platform) {
      return false;
    }
    return (
      !search ||
      [subscription.channelName, subscription.channelId, subscription.feedUrl].some((value) =>
        value.toLowerCase().includes(search)
      )
    );
  }

  function showMoreButton(remaining: number): HTMLButtonElement {
    const button = createEl("button", {
      className: "button button--quiet",
      text: t("subs-show-more", { count: Math.min(LIST_PAGE_SIZE, remaining), remaining }),
      attrs: { type: "button" },
    });
    button.addEventListener("click", () => {
      visibleCount += LIST_PAGE_SIZE;
      renderList();
    });
    return button;
  }

  /**
   * Builds at most `visibleCount` rows: thousands of rows with their listeners would make
   * every render slow. Skipped entirely when nothing it shows has changed.
   */
  function renderList(): void {
    const search = elements.search.value.trim().toLowerCase();
    const platform = elements.filter.value || ALL;
    const inputs = [subscriptions(), search, platform, visibleCount, currentLanguage()] as const;
    if (lastListInputs?.every((value, index) => value === inputs[index])) {
      return;
    }
    lastListInputs = inputs;

    const values = subscriptions().filter((subscription) =>
      matchesFilters(subscription, search, platform)
    );

    if (values.length === 0) {
      elements.list.replaceChildren(
        hintParagraph(subscriptions().length === 0 ? t("subs-empty") : t("subs-no-matches"))
      );
      return;
    }

    const visible = values.slice(0, visibleCount);
    const remaining = values.length - visible.length;
    elements.list.replaceChildren(
      ...visible.map(subscriptionRow),
      ...(remaining > 0 ? [showMoreButton(remaining)] : [])
    );
    fitListToRows(elements.list);
  }

  /** A new search or filter starts from the first page again. */
  function restartList(): void {
    visibleCount = LIST_PAGE_SIZE;
    renderList();
  }

  function render(): void {
    renderList();
    renderInstanceOptions();
  }

  function reset(): void {
    editingKey = null;
    elements.form.reset();
    elements.platform.value = DEFAULT_PLATFORM;
    setText(submit, t("common-add"));
    elements.cancel.hidden = true;
    setMessage(elements.error, "");
    updateForm();
  }

  // --- Form submission -------------------------------------------------------

  /**
   * Builds the raw subscription from the form. YouTube `@handles` and channel URLs without the
   * id (`/@name/videos`, `/c/…`, `/user/…`) are resolved to a `UC…` id here, because the feed
   * endpoint only accepts channel ids.
   */
  async function readForm(): Promise<RawSubscription> {
    const platform = elements.platform.value;
    const definition = getPlatform(platform);
    const needsFeed = definition.requiresFeedUrl;
    const channelInput = needsFeed ? "" : elements.channel.value.trim();
    // The alias is stored as the channel name. When empty, the name looked up for a YouTube
    // handle is used, otherwise the channel id (see normalizeSubscription).
    const channelName = elements.alias.value.trim();

    const raw = {
      platform,
      instanceUrl: definition.instanceKind ? elements.instance.value : "",
      channelId: channelInput,
      channelUrl: parseHttpUrl(channelInput) ? channelInput : "",
      channelName,
      feedUrl: needsFeed || definition.allowsFeedUrl ? elements.feedUrl.value.trim() : "",
      // New subscriptions start enabled; editing keeps the state set in the list.
      enabled: editedSubscription()?.enabled ?? true,
    };

    if (platform !== "youtube" || !needsYouTubeLookup(channelInput)) {
      return raw;
    }

    // Must be the first await so Firefox still treats the request as user-initiated.
    if (!(await requestOrigins([PLATFORMS.youtube.permissionOrigin]))) {
      throw new LocalizedError("subs-youtube-access");
    }
    const resolved = await resolveYouTubeChannel(channelInput, {
      fetchText,
      postJson,
      timeoutMs: app.state.settings.feed.timeoutMs,
    });
    return { ...raw, ...resolved, channelName: channelName || resolved.channelName };
  }

  function nextSubscriptions(subscription: Subscription): Subscription[] {
    if (editingKey === null) {
      return [...subscriptions(), subscription];
    }
    const replaced = subscriptions().map((value) =>
      subscriptionKey(value) === editingKey ? subscription : value
    );
    const seen = new Set<string>();
    return replaced.filter((value) => {
      const key = subscriptionKey(value);
      const isFirst = !seen.has(key);
      seen.add(key);
      return isFirst;
    });
  }

  async function submitForm(): Promise<void> {
    setMessage(elements.error, "");

    let raw: RawSubscription;
    try {
      raw = await readForm();
    } catch (error) {
      setMessage(elements.error, errorMessage(error, t("subs-read-failed")), {
        error: true,
      });
      return;
    }

    const result = normalizeSubscription(raw);
    if (!result.subscription) {
      setMessage(elements.error, result.errors, { error: true });
      return;
    }

    const nextKey = subscriptionKey(result.subscription);
    const conflict =
      nextKey !== editingKey &&
      subscriptions().some((subscription) => subscriptionKey(subscription) === nextKey);
    if (conflict) {
      setMessage(elements.error, t("subs-exists"), { error: true });
      return;
    }

    const wasEditing = editingKey !== null;
    await saveSubscriptions(nextSubscriptions(result.subscription));
    reset();
    showToast(wasEditing ? t("subs-saved") : t("subs-added"));
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void withDisabled(submit, submitForm);
  });

  // --- Bulk actions ----------------------------------------------------------

  function setAllEnabled(enabled: boolean): void {
    void saveSubscriptions(
      subscriptions().map((subscription) => ({ ...subscription, enabled }))
    ).then(() => {
      showToast(enabled ? t("subs-all-enabled") : t("subs-all-disabled"));
    });
  }

  elements.enableAll.addEventListener("click", () => {
    setAllEnabled(true);
  });
  elements.disableAll.addEventListener("click", () => {
    setAllEnabled(false);
  });

  elements.deleteDisabled.addEventListener("click", () => {
    const disabledCount = subscriptions().filter((subscription) => !subscription.enabled).length;
    if (disabledCount === 0) {
      showToast(t("subs-none-disabled"));
      return;
    }
    if (!window.confirm(t("subs-confirm-delete-disabled", { count: disabledCount }))) {
      return;
    }
    void saveSubscriptions(subscriptions().filter((subscription) => subscription.enabled)).then(
      () => {
        showToast(t("subs-disabled-deleted"));
      }
    );
  });

  elements.section.addEventListener("toggle", () => {
    fitListToRows(elements.list);
  });
  let searchTimer: number | undefined;
  elements.search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(restartList, SEARCH_DEBOUNCE_MS);
  });
  elements.filter.addEventListener("change", restartList);
  elements.platform.addEventListener("change", updateForm);
  elements.cancel.addEventListener("click", reset);

  fillPlatformOptions(elements.platform);
  fillPlatformOptions(elements.filter, { includeAll: true });
  elements.filter.value = ALL;
  elements.platform.value = DEFAULT_PLATFORM;
  updateForm();

  return { render, reset };
}
