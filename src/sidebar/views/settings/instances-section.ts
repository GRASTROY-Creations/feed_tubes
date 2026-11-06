import { createId, getElement, setMessage, setText } from "../../../lib/dom.js";
import { errorMessage } from "../../../lib/errors.js";
import { fetchText } from "../../../lib/fetch.js";
import { requestOrigins } from "../../../lib/permissions.js";
import { INSTANCE_KIND_LABELS, isInstanceKind } from "../../../lib/platforms/registry.js";
import type { Instance } from "../../../lib/types.js";
import { normalizeBaseUrl, originPattern } from "../../../lib/url.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import {
  hintParagraph,
  listRow,
  submitButtonOf,
  withDisabled,
  type SettingsSection,
} from "./shared.js";

const TEST_TIMEOUT_MS = 10_000;
const INVALID_URL_MESSAGE = "Enter a valid http(s) base URL.";

export function instanceLabel(instance: Instance): string {
  return instance.label || INSTANCE_KIND_LABELS[instance.kind];
}

export function initInstancesSection(app: AppContext): SettingsSection {
  const elements = {
    list: getElement("instance-list", HTMLDivElement),
    form: getElement("instance-form", HTMLFormElement),
    kind: getElement("instance-kind", HTMLSelectElement),
    label: getElement("instance-label", HTMLInputElement),
    url: getElement("instance-url", HTMLInputElement),
    test: getElement("instance-test", HTMLButtonElement),
    cancel: getElement("instance-cancel", HTMLButtonElement),
    result: getElement("instance-result", HTMLParagraphElement),
  };
  const submit = submitButtonOf(elements.form);

  let editingId: string | null = null;

  const instances = (): Instance[] => app.state.settings.instances;

  async function saveInstances(next: Instance[]): Promise<void> {
    await app.persistSettings({ ...app.state.settings, instances: next });
  }

  function startEditing(instance: Instance): void {
    editingId = instance.id;
    elements.kind.value = instance.kind;
    elements.label.value = instance.label;
    elements.url.value = instance.url;
    setText(submit, "Save instance");
    elements.cancel.hidden = false;
    setMessage(elements.result, "");
    elements.form.scrollIntoView({ block: "nearest" });
    elements.url.focus();
  }

  async function removeInstance(instance: Instance): Promise<void> {
    const confirmed = window.confirm(
      `Remove the ${instanceLabel(instance)} instance? Existing subscriptions keep their own instance URL.`
    );
    if (!confirmed) {
      return;
    }
    await saveInstances(instances().filter((value) => value.id !== instance.id));
    showToast("Instance removed.");
  }

  function render(): void {
    const values = instances();
    if (values.length === 0) {
      elements.list.replaceChildren(
        hintParagraph("No instances configured. Add a PeerTube instance or bridge base below.")
      );
      return;
    }

    elements.list.replaceChildren(
      ...values.map((instance) =>
        listRow({
          title: instanceLabel(instance),
          meta: `${INSTANCE_KIND_LABELS[instance.kind]} · ${instance.url}`,
          onEdit: () => {
            startEditing(instance);
          },
          removeLabel: "Remove",
          onRemove: () => void removeInstance(instance),
        })
      )
    );
  }

  function reset(): void {
    editingId = null;
    elements.form.reset();
    elements.kind.value = "peertube";
    setText(submit, "Add instance");
    elements.cancel.hidden = true;
    setMessage(elements.result, "");
  }

  function validationError(kind: string, url: string): string {
    if (!url) {
      return INVALID_URL_MESSAGE;
    }
    if (!isInstanceKind(kind)) {
      return "Choose an instance kind.";
    }
    const duplicate = instances().some(
      (instance) =>
        instance.id !== editingId &&
        instance.kind === kind &&
        instance.url.toLowerCase() === url.toLowerCase()
    );
    return duplicate ? "That instance is already configured." : "";
  }

  async function save(): Promise<void> {
    const kind = elements.kind.value;
    const label = elements.label.value.trim();
    const url = normalizeBaseUrl(elements.url.value);

    const error = validationError(kind, url);
    if (error || !isInstanceKind(kind)) {
      setMessage(elements.result, error, { error: true });
      return;
    }

    const wasEditing = editingId !== null;
    const next = wasEditing
      ? instances().map((instance) =>
          instance.id === editingId ? { ...instance, kind, label, url } : instance
        )
      : [...instances(), { id: createId("instance"), kind, label, url }];

    await saveInstances(next);
    reset();
    showToast(wasEditing ? "Instance saved." : "Instance added.");
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });

  elements.test.addEventListener("click", () => {
    const base = normalizeBaseUrl(elements.url.value);
    if (!base) {
      setMessage(elements.result, INVALID_URL_MESSAGE, { error: true });
      return;
    }

    // Request the permission before any await so it still counts as a user action.
    const permission = requestOrigins([originPattern(base)]);
    const endpoint = elements.kind.value === "peertube" ? `${base}/api/v1/config` : base;
    setMessage(elements.result, "Testing connection…");

    void withDisabled(elements.test, async () => {
      try {
        if (!(await permission)) {
          setMessage(elements.result, "Access to this host was not granted.", { error: true });
          return;
        }
        await fetchText(endpoint, { timeoutMs: TEST_TIMEOUT_MS, retries: 0 });
        setMessage(elements.result, "Connection succeeded.");
      } catch (error) {
        setMessage(elements.result, `Connection failed: ${errorMessage(error, "unknown error")}`, {
          error: true,
        });
      }
    });
  });

  elements.cancel.addEventListener("click", reset);

  return { render, reset };
}
