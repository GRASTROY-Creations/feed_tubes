import {
  createEl,
  createId,
  formatBytes,
  clearElement,
  setHidden,
  setText,
} from "../../lib/dom.js";
import { fetchText } from "../../lib/fetch.js";
import {
  EXPORT_FORMATS,
  parseSubscriptionsFile,
  exportSubscriptions,
} from "../../lib/import-export.js";
import { requestOrigins } from "../../lib/permissions.js";
import { PLATFORM_IDS, platformLabel, requiresFeedUrl } from "../../lib/platforms/registry.js";
import {
  instanceKindForPlatform,
  mergeSubscriptions,
  normalizeSubscription,
  subscriptionKey,
} from "../../lib/subscriptions.js";
import { estimateStorageBytes } from "../../lib/storage.js";
import { normalizeBaseUrl, originPattern, parseHttpUrl } from "../../lib/url.js";
import { showToast } from "../components/toast.js";

const INSTANCE_KIND_LABELS = {
  peertube: "PeerTube",
  rsshub: "RSSHub",
  vk: "VK bridge",
  bilibili: "Bilibili bridge",
  rumble: "Rumble bridge",
  generic: "Generic RSS",
};

const PLATFORM_PLACEHOLDERS = {
  youtube: "UC… / channel URL / @handle",
  peertube: "Channel handle or /c/ URL",
  odysee: "@name:claimid",
  rutube: "Numeric channel ID or URL",
  dailymotion: "Username or channel URL",
  vkvideo: "Optional channel ID",
  bilibili: "Optional UID",
  rumble: "Optional channel slug",
  generic: "Optional channel ID",
};

function setMessage(element, message, { error = false } = {}) {
  if (!element) {
    return;
  }
  element.textContent = message || "";
  element.hidden = !message;
  element.classList.toggle("banner--error", Boolean(error));
}

function instanceLabel(instance) {
  if (instance.label) {
    return instance.label;
  }
  return INSTANCE_KIND_LABELS[instance.kind] || "Instance";
}

function instanceKindLabel(kind) {
  return INSTANCE_KIND_LABELS[kind] || kind;
}

function instanceListText(instance) {
  return `${instanceKindLabel(instance.kind)} · ${instance.url}`;
}

function readFileText(file) {
  if (file.text) {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = createEl("a", {
    className: "hidden-download",
    attrs: { href: url, download: filename },
  });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initSettingsView(app) {
  const elements = {
    instanceList: document.getElementById("instance-list"),
    instanceForm: document.getElementById("instance-form"),
    instanceKind: document.getElementById("instance-kind"),
    instanceLabel: document.getElementById("instance-label"),
    instanceUrl: document.getElementById("instance-url"),
    instanceTest: document.getElementById("instance-test"),
    instanceCancel: document.getElementById("instance-cancel"),
    instanceResult: document.getElementById("instance-result"),

    subscriptionSearch: document.getElementById("subscription-search"),
    subscriptionFilter: document.getElementById("subscription-filter"),
    subscriptionList: document.getElementById("subscription-list"),
    subscriptionForm: document.getElementById("subscription-form"),
    subscriptionPlatform: document.getElementById("subscription-platform"),
    subscriptionInstanceRow: document.getElementById("subscription-instance-row"),
    subscriptionInstance: document.getElementById("subscription-instance"),
    subscriptionChannel: document.getElementById("subscription-channel"),
    subscriptionName: document.getElementById("subscription-name"),
    subscriptionFeedRow: document.getElementById("subscription-feed-row"),
    subscriptionFeedUrl: document.getElementById("subscription-feed-url"),
    subscriptionEnabled: document.getElementById("subscription-enabled"),
    subscriptionCancel: document.getElementById("subscription-cancel"),
    subscriptionError: document.getElementById("subscription-error"),
    enableAll: document.getElementById("enable-all"),
    disableAll: document.getElementById("disable-all"),
    deleteDisabled: document.getElementById("delete-disabled"),

    refreshInterval: document.getElementById("refresh-interval"),
    refreshEnabled: document.getElementById("refresh-enabled"),

    importFile: document.getElementById("import-file"),
    importMode: document.getElementById("import-mode"),
    importButton: document.getElementById("import-button"),
    importReport: document.getElementById("import-report"),
    exportFormat: document.getElementById("export-format"),
    exportScope: document.getElementById("export-scope"),
    exportButton: document.getElementById("export-button"),

    storageUsage: document.getElementById("storage-usage"),
    clearCache: document.getElementById("clear-cache"),
    resetData: document.getElementById("reset-data"),
    version: document.getElementById("version"),
  };

  let editingInstanceId = null;
  let editingSubscriptionKey = null;

  function subscriptions() {
    return app.data.subscriptions;
  }

  function instances() {
    return app.data.settings.instances;
  }

  function instancesForKind(kind) {
    if (["vk", "bilibili", "rumble", "generic"].includes(kind)) {
      return instances().filter((instance) => instance.kind === kind || instance.kind === "rsshub");
    }
    return instances().filter((instance) => instance.kind === kind);
  }

  function renderInstanceList() {
    if (!elements.instanceList) {
      return;
    }

    clearElement(elements.instanceList);
    const values = instances();

    if (values.length === 0) {
      elements.instanceList.append(
        createEl("p", {
          className: "hint",
          text: "No instances configured. Add a PeerTube instance or bridge base below.",
        })
      );
      return;
    }

    for (const instance of values) {
      const row = createEl("div", { className: "list-item" });
      const text = createEl("div", { className: "list-item__text" });
      text.append(
        createEl("p", { className: "list-item__title", text: instanceLabel(instance) }),
        createEl("p", { className: "list-item__meta", text: instanceListText(instance) })
      );

      const actions = createEl("div", { className: "list-item__actions" });
      const edit = createEl("button", {
        className: "button button--compact",
        text: "Edit",
        attrs: { type: "button" },
      });
      edit.addEventListener("click", () => {
        editingInstanceId = instance.id;
        elements.instanceKind.value = instance.kind;
        elements.instanceLabel.value = instance.label || "";
        elements.instanceUrl.value = instance.url;
        setText(elements.instanceForm.querySelector('button[type="submit"]'), "Save instance");
        setHidden(elements.instanceCancel, false);
        setMessage(elements.instanceResult, "");
        elements.instanceForm.scrollIntoView({ block: "nearest" });
        elements.instanceUrl.focus();
      });

      const remove = createEl("button", {
        className: "button button--compact button--danger",
        text: "Remove",
        attrs: { type: "button" },
      });
      remove.addEventListener("click", async () => {
        if (
          !window.confirm(
            `Remove the ${instanceLabel(instance)} instance? Existing subscriptions keep their own instance URL.`
          )
        ) {
          return;
        }
        await app.persistSettings({
          ...app.data.settings,
          instances: instances().filter((value) => value.id !== instance.id),
        });
        showToast("Instance removed.");
      });

      actions.append(edit, remove);
      row.append(text, actions);
      elements.instanceList.append(row);
    }
  }

  function resetInstanceForm() {
    editingInstanceId = null;
    elements.instanceForm.reset();
    elements.instanceKind.value = "peertube";
    setText(elements.instanceForm.querySelector('button[type="submit"]'), "Add instance");
    setHidden(elements.instanceCancel, true);
    setMessage(elements.instanceResult, "");
    renderSubscriptionInstances();
  }

  function renderSubscriptionInstances() {
    const platform = elements.subscriptionPlatform.value || "youtube";
    const kind = instanceKindForPlatform(platform);
    const row = elements.subscriptionInstanceRow;

    setHidden(row, !kind);
    if (!kind) {
      clearElement(elements.subscriptionInstance);
      return;
    }

    const previous = elements.subscriptionInstance.value;
    const options = instancesForKind(kind);
    clearElement(elements.subscriptionInstance);

    if (kind !== "peertube") {
      elements.subscriptionInstance.append(
        createEl("option", { text: "No instance selected", attrs: { value: "" } })
      );
    }

    for (const instance of options) {
      elements.subscriptionInstance.append(
        createEl("option", {
          text: instanceLabel(instance),
          attrs: { value: instance.url },
        })
      );
    }

    if (options.length === 0) {
      elements.subscriptionInstance.append(
        createEl("option", {
          text: `Add a ${instanceKindLabel(kind)} instance above`,
          attrs: { value: "", disabled: "disabled" },
        })
      );
    }

    const values = Array.from(elements.subscriptionInstance.options).map((option) => option.value);
    if (previous && values.includes(previous)) {
      elements.subscriptionInstance.value = previous;
    } else if (options.length > 0) {
      elements.subscriptionInstance.value = options[0].url;
    } else {
      elements.subscriptionInstance.value = "";
    }
  }

  function updateSubscriptionForm() {
    const platform = elements.subscriptionPlatform.value || "youtube";
    const needsFeed = requiresFeedUrl(platform);
    const kind = instanceKindForPlatform(platform);

    setHidden(elements.subscriptionFeedRow, !needsFeed);
    elements.subscriptionFeedUrl.required = needsFeed;
    elements.subscriptionChannel.required = !needsFeed;
    elements.subscriptionChannel.placeholder =
      PLATFORM_PLACEHOLDERS[platform] || "Channel ID or URL";
    elements.subscriptionChannel.disabled = needsFeed;
    if (needsFeed) {
      elements.subscriptionChannel.value = "";
    }
    setHidden(elements.subscriptionInstanceRow, !kind);
    renderSubscriptionInstances();
  }

  function subscriptionRow(subscription) {
    const key = subscriptionKey(subscription);
    const row = createEl("div", { className: "list-item" });

    const toggle = createEl("input", {
      className: "list-item__toggle",
      attrs: { type: "checkbox", "aria-label": `Enable ${subscription.channelName}` },
      props: { checked: Boolean(subscription.enabled) },
    });
    toggle.addEventListener("change", async () => {
      const next = subscriptions().map((value) =>
        subscriptionKey(value) === key ? { ...value, enabled: toggle.checked } : value
      );
      await app.persistSubscriptions(next);
    });

    const text = createEl("div", { className: "list-item__text" });
    const detail = subscription.channelId || subscription.feedUrl || subscription.channelUrl;
    text.append(
      createEl("p", {
        className: "list-item__title",
        text: subscription.channelName || subscription.channelId || "Subscription",
      }),
      createEl("p", {
        className: "list-item__meta",
        text: `${platformLabel(subscription.platform)} · ${detail}`,
      })
    );

    const actions = createEl("div", { className: "list-item__actions" });
    const edit = createEl("button", {
      className: "button button--compact",
      text: "Edit",
      attrs: { type: "button" },
    });
    edit.addEventListener("click", () => {
      editingSubscriptionKey = key;
      elements.subscriptionPlatform.value = subscription.platform;
      updateSubscriptionForm();
      elements.subscriptionInstance.value =
        subscription.instanceUrl || elements.subscriptionInstance.value;
      elements.subscriptionChannel.value = subscription.channelId || subscription.channelUrl || "";
      elements.subscriptionName.value = subscription.channelName || "";
      elements.subscriptionFeedUrl.value = subscription.feedUrl || "";
      elements.subscriptionEnabled.checked = Boolean(subscription.enabled);
      setText(
        elements.subscriptionForm.querySelector('button[type="submit"]'),
        "Save subscription"
      );
      setHidden(elements.subscriptionCancel, false);
      setMessage(elements.subscriptionError, "");
      elements.subscriptionForm.scrollIntoView({ block: "nearest" });
      elements.subscriptionChannel.focus();
    });

    const remove = createEl("button", {
      className: "button button--compact button--danger",
      text: "Delete",
      attrs: { type: "button" },
    });
    remove.addEventListener("click", async () => {
      const next = subscriptions().filter((value) => subscriptionKey(value) !== key);
      await app.persistSubscriptions(next);
      if (editingSubscriptionKey === key) {
        resetSubscriptionForm();
      }
      showToast("Subscription deleted.");
    });

    actions.append(edit, remove);
    row.append(toggle, text, actions);
    return row;
  }

  function renderSubscriptions() {
    if (!elements.subscriptionList) {
      return;
    }

    const search = elements.subscriptionSearch.value.trim().toLowerCase();
    const platform = elements.subscriptionFilter.value || "all";
    const values = subscriptions().filter((subscription) => {
      if (platform !== "all" && subscription.platform !== platform) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [subscription.channelName, subscription.channelId, subscription.feedUrl]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    clearElement(elements.subscriptionList);
    if (values.length === 0) {
      elements.subscriptionList.append(
        createEl("p", {
          className: "hint",
          text:
            subscriptions().length === 0
              ? "No subscriptions yet."
              : "No subscriptions match the current filters.",
        })
      );
      return;
    }

    for (const subscription of values) {
      elements.subscriptionList.append(subscriptionRow(subscription));
    }
  }

  function resetSubscriptionForm() {
    editingSubscriptionKey = null;
    elements.subscriptionForm.reset();
    elements.subscriptionPlatform.value = "youtube";
    elements.subscriptionEnabled.checked = true;
    elements.subscriptionFeedUrl.value = "";
    elements.subscriptionChannel.value = "";
    setText(elements.subscriptionForm.querySelector('button[type="submit"]'), "Add subscription");
    setHidden(elements.subscriptionCancel, true);
    setMessage(elements.subscriptionError, "");
    updateSubscriptionForm();
  }

  function renderRefresh() {
    const refresh = app.data.settings.refresh;
    elements.refreshInterval.value = String(refresh.intervalMinutes);
    elements.refreshEnabled.checked = Boolean(refresh.enabled);
  }

  function renderData() {
    const bytes = estimateStorageBytes(app.data);
    setText(
      elements.storageUsage,
      `Stored data: ${formatBytes(bytes)}. Cache clears safely; subscriptions and settings are kept.`
    );
    setText(elements.version, browser.runtime.getManifest().version);
  }

  function render() {
    if (!app.data) {
      return;
    }
    renderInstanceList();
    renderSubscriptions();
    renderRefresh();
    renderData();
  }

  elements.instanceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(elements.instanceResult, "");

    const kind = elements.instanceKind.value;
    const label = elements.instanceLabel.value.trim();
    const url = normalizeBaseUrl(elements.instanceUrl.value);

    if (!url) {
      setMessage(elements.instanceResult, "Enter a valid http(s) base URL.", { error: true });
      return;
    }

    if (!INSTANCE_KIND_LABELS[kind]) {
      setMessage(elements.instanceResult, "Choose an instance kind.", { error: true });
      return;
    }

    const duplicate = instances().some(
      (instance) =>
        instance.id !== editingInstanceId &&
        instance.kind === kind &&
        instance.url.toLowerCase() === url.toLowerCase()
    );
    if (duplicate) {
      setMessage(elements.instanceResult, "That instance is already configured.", {
        error: true,
      });
      return;
    }

    const wasEditing = Boolean(editingInstanceId);
    const next = wasEditing
      ? instances().map((instance) =>
          instance.id === editingInstanceId ? { ...instance, kind, label, url } : instance
        )
      : [...instances(), { id: createId("instance"), kind, label, url }];

    await app.persistSettings({ ...app.data.settings, instances: next });
    resetInstanceForm();
    showToast(wasEditing ? "Instance saved." : "Instance added.");
  });

  elements.instanceTest.addEventListener("click", async () => {
    const base = normalizeBaseUrl(elements.instanceUrl.value);
    if (!base) {
      setMessage(elements.instanceResult, "Enter a valid http(s) base URL.", { error: true });
      return;
    }

    const kind = elements.instanceKind.value;
    const origin = originPattern(base);
    elements.instanceTest.disabled = true;
    setMessage(elements.instanceResult, "Testing connection…");

    try {
      const granted = await requestOrigins([origin]);
      if (!granted) {
        setMessage(elements.instanceResult, "Access to this host was not granted.", {
          error: true,
        });
        return;
      }

      const endpoint = kind === "peertube" ? `${base}/api/v1/config` : base;
      await fetchText(endpoint, { timeoutMs: 10000, retries: 0 });
      setMessage(elements.instanceResult, "Connection succeeded.");
    } catch (error) {
      setMessage(
        elements.instanceResult,
        `Connection failed: ${error?.message || "unknown error"}`,
        { error: true }
      );
    } finally {
      elements.instanceTest.disabled = false;
    }
  });

  elements.instanceCancel.addEventListener("click", resetInstanceForm);
  elements.subscriptionPlatform.addEventListener("change", updateSubscriptionForm);
  elements.subscriptionCancel.addEventListener("click", resetSubscriptionForm);

  elements.subscriptionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(elements.subscriptionError, "");

    const platform = elements.subscriptionPlatform.value;
    const needsFeed = requiresFeedUrl(platform);
    const channelInput = elements.subscriptionChannel.value.trim();
    const feedInput = elements.subscriptionFeedUrl.value.trim();
    const instanceUrl = instanceKindForPlatform(platform)
      ? elements.subscriptionInstance.value
      : "";

    const raw = {
      platform,
      instanceUrl,
      channelId: needsFeed ? "" : channelInput,
      channelUrl: needsFeed ? "" : parseHttpUrl(channelInput) ? channelInput : "",
      channelName: elements.subscriptionName.value.trim(),
      feedUrl: needsFeed ? feedInput : "",
      enabled: elements.subscriptionEnabled.checked,
    };

    const result = normalizeSubscription(raw);
    if (!result.subscription) {
      setMessage(elements.subscriptionError, result.errors.join(" "), { error: true });
      return;
    }

    const nextSubscription = result.subscription;
    const nextKey = subscriptionKey(nextSubscription);
    const conflict = subscriptions().some(
      (subscription) =>
        subscriptionKey(subscription) === nextKey &&
        subscriptionKey(subscription) !== editingSubscriptionKey
    );
    if (conflict) {
      setMessage(elements.subscriptionError, "This subscription already exists.", {
        error: true,
      });
      return;
    }

    const wasEditing = Boolean(editingSubscriptionKey);
    const next = wasEditing
      ? subscriptions()
          .map((subscription) =>
            subscriptionKey(subscription) === editingSubscriptionKey
              ? nextSubscription
              : subscription
          )
          .filter(
            (subscription, index, all) =>
              all.findIndex((value) => subscriptionKey(value) === subscriptionKey(subscription)) ===
              index
          )
      : [...subscriptions(), nextSubscription];

    await app.persistSubscriptions(next);
    resetSubscriptionForm();
    showToast(wasEditing ? "Subscription saved." : "Subscription added.");
  });

  elements.subscriptionSearch.addEventListener("input", renderSubscriptions);
  elements.subscriptionFilter.addEventListener("change", renderSubscriptions);

  elements.enableAll.addEventListener("click", async () => {
    await app.persistSubscriptions(
      subscriptions().map((subscription) => ({ ...subscription, enabled: true }))
    );
    showToast("All subscriptions enabled.");
  });

  elements.disableAll.addEventListener("click", async () => {
    await app.persistSubscriptions(
      subscriptions().map((subscription) => ({ ...subscription, enabled: false }))
    );
    showToast("All subscriptions disabled.");
  });

  elements.deleteDisabled.addEventListener("click", async () => {
    const disabled = subscriptions().filter((subscription) => !subscription.enabled);
    if (disabled.length === 0) {
      showToast("There are no disabled subscriptions.");
      return;
    }
    if (!window.confirm(`Delete ${disabled.length} disabled subscription(s)?`)) {
      return;
    }
    await app.persistSubscriptions(subscriptions().filter((subscription) => subscription.enabled));
    showToast("Disabled subscriptions deleted.");
  });

  elements.refreshInterval.addEventListener("change", async () => {
    await app.persistSettings({
      ...app.data.settings,
      refresh: {
        ...app.data.settings.refresh,
        intervalMinutes: Number(elements.refreshInterval.value),
      },
    });
    showToast("Refresh schedule updated.");
  });

  elements.refreshEnabled.addEventListener("change", async () => {
    await app.persistSettings({
      ...app.data.settings,
      refresh: {
        ...app.data.settings.refresh,
        enabled: elements.refreshEnabled.checked,
      },
    });
    showToast(
      elements.refreshEnabled.checked
        ? "Background refresh enabled."
        : "Background refresh disabled."
    );
  });

  elements.importButton.addEventListener("click", async () => {
    const file = elements.importFile.files?.[0];
    if (!file) {
      setMessage(elements.importReport, "Choose a subscription file first.", { error: true });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage(elements.importReport, "The file is larger than the 5 MB limit.", {
        error: true,
      });
      return;
    }

    elements.importButton.disabled = true;
    setMessage(elements.importReport, "Importing…");

    try {
      const text = await readFileText(file);
      const parsed = parseSubscriptionsFile(text, file.name);

      if (parsed.subscriptions.length === 0) {
        setMessage(elements.importReport, "No valid subscriptions were found.", {
          error: true,
        });
        return;
      }

      const mode = elements.importMode.value;
      if (
        mode === "replace" &&
        subscriptions().length > 0 &&
        !window.confirm("Replace all existing subscriptions with this file?")
      ) {
        return;
      }

      const next = mergeSubscriptions(subscriptions(), parsed.subscriptions, mode);
      await app.persistSubscriptions(next);
      elements.importFile.value = "";

      const details = [
        `Imported ${parsed.subscriptions.length} subscription(s) from ${parsed.format}.`,
      ];
      if (parsed.invalid.length > 0) {
        details.push(`${parsed.invalid.length} invalid row(s) skipped.`);
      }
      if (parsed.warnings?.length) {
        details.push(parsed.warnings.join(" "));
      }
      if (next.length !== parsed.subscriptions.length) {
        details.push(`${next.length} subscription(s) stored.`);
      }
      setMessage(elements.importReport, details.join(" "));
      showToast("Subscriptions imported.");
    } catch (error) {
      setMessage(elements.importReport, error?.message || "Could not import the file.", {
        error: true,
      });
    } finally {
      elements.importButton.disabled = false;
    }
  });

  elements.exportButton.addEventListener("click", () => {
    const format = elements.exportFormat.value;
    const scope = elements.exportScope.value;

    try {
      const output = exportSubscriptions(format, subscriptions(), scope);
      if (!output.text.trim()) {
        showToast("Nothing to export for this format.", { error: true });
        return;
      }
      downloadText(output.filename, output.text, output.mime);
      showToast(`Exported ${output.filename}.`);
    } catch (error) {
      showToast(error?.message || "Could not export subscriptions.", { error: true });
    }
  });

  elements.clearCache.addEventListener("click", async () => {
    await app.clearCache();
    showToast("Feed cache cleared.");
  });

  elements.resetData.addEventListener("click", async () => {
    if (!window.confirm("Reset all FeedTubes data, including subscriptions and settings?")) {
      return;
    }
    await app.resetAll();
    resetInstanceForm();
    resetSubscriptionForm();
    showToast("All data reset.");
  });

  function initializeFormOptions() {
    clearElement(elements.subscriptionPlatform);
    for (const platform of PLATFORM_IDS) {
      elements.subscriptionPlatform.append(
        createEl("option", {
          text: platformLabel(platform),
          attrs: { value: platform },
        })
      );
    }

    clearElement(elements.subscriptionFilter);
    elements.subscriptionFilter.append(
      createEl("option", { text: "All platforms", attrs: { value: "all" } })
    );
    for (const platform of PLATFORM_IDS) {
      elements.subscriptionFilter.append(
        createEl("option", {
          text: platformLabel(platform),
          attrs: { value: platform },
        })
      );
    }

    clearElement(elements.exportFormat);
    for (const format of EXPORT_FORMATS) {
      elements.exportFormat.append(
        createEl("option", {
          text: format.label,
          attrs: { value: format.id },
        })
      );
    }

    elements.subscriptionFilter.value = "all";
    elements.subscriptionPlatform.value = "youtube";
    elements.exportFormat.value = "unified-csv";
    updateSubscriptionForm();
  }

  initializeFormOptions();

  return { render };
}
