import { createId, getElement, setMessage, setText } from "../../../lib/dom.js";
import { errorMessage } from "../../../lib/errors.js";
import { fetchText } from "../../../lib/fetch.js";
import { requestOrigins } from "../../../lib/permissions.js";
import { instanceKindLabel, isInstanceKind } from "../../../lib/platforms/registry.js";
import type { Instance } from "../../../lib/types.js";
import { normalizeBaseUrl, originPattern } from "../../../lib/url.js";
import type { AppContext } from "../../app-context.js";
import { showToast } from "../../components/toast.js";
import {
  fitListToRows,
  hintParagraph,
  listRow,
  submitButtonOf,
  withDisabled,
  type SettingsSection,
} from "./shared.js";
import { t } from "../../../lib/i18n/index.js";

const TEST_TIMEOUT_MS = 10_000;

export function instanceLabel(instance: Instance): string {
  return instance.label || instanceKindLabel(instance.kind);
}

export function initInstancesSection(app: AppContext): SettingsSection {
  const elements = {
    section: getElement("settings-instances", HTMLDetailsElement),
    search: getElement("instance-search", HTMLInputElement),
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
    setText(submit, t("common-save"));
    elements.cancel.hidden = false;
    setMessage(elements.result, "");
    elements.form.scrollIntoView({ block: "nearest" });
    elements.url.focus();
  }

  async function removeInstance(instance: Instance): Promise<void> {
    const confirmed = window.confirm(t("inst-confirm-remove", { name: instanceLabel(instance) }));
    if (!confirmed) {
      return;
    }
    await saveInstances(instances().filter((value) => value.id !== instance.id));
    showToast(t("inst-removed"));
  }

  function matchesSearch(instance: Instance, search: string): boolean {
    return (
      !search ||
      [instanceLabel(instance), instanceKindLabel(instance.kind), instance.url].some((value) =>
        value.toLowerCase().includes(search)
      )
    );
  }

  function render(): void {
    const search = elements.search.value.trim().toLowerCase();
    const values = instances().filter((instance) => matchesSearch(instance, search));

    if (values.length === 0) {
      elements.list.replaceChildren(
        hintParagraph(instances().length === 0 ? t("inst-empty") : t("inst-no-matches"))
      );
      return;
    }

    elements.list.replaceChildren(
      ...values.map((instance) =>
        listRow({
          title: instanceLabel(instance),
          meta: `${instanceKindLabel(instance.kind)} · ${instance.url}`,
          onEdit: () => {
            startEditing(instance);
          },
          removeLabel: t("common-remove"),
          onRemove: () => void removeInstance(instance),
        })
      )
    );
    fitListToRows(elements.list);
  }

  function reset(): void {
    editingId = null;
    elements.form.reset();
    elements.kind.value = "peertube";
    setText(submit, t("common-add"));
    elements.cancel.hidden = true;
    setMessage(elements.result, "");
  }

  function validationError(kind: string, url: string): string {
    if (!url) {
      return t("inst-invalid-url");
    }
    if (!isInstanceKind(kind)) {
      return t("inst-choose-kind");
    }
    const duplicate = instances().some(
      (instance) =>
        instance.id !== editingId &&
        instance.kind === kind &&
        instance.url.toLowerCase() === url.toLowerCase()
    );
    return duplicate ? t("inst-duplicate") : "";
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
    showToast(wasEditing ? t("inst-saved") : t("inst-added"));
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });

  elements.test.addEventListener("click", () => {
    const base = normalizeBaseUrl(elements.url.value);
    if (!base) {
      setMessage(elements.result, t("inst-invalid-url"), { error: true });
      return;
    }

    // Request the permission before any await so it still counts as a user action.
    const permission = requestOrigins([originPattern(base)]);
    const endpoint = elements.kind.value === "peertube" ? `${base}/api/v1/config` : base;
    setMessage(elements.result, t("inst-testing"));

    void withDisabled(elements.test, async () => {
      try {
        if (!(await permission)) {
          setMessage(elements.result, t("inst-access-denied"), { error: true });
          return;
        }
        await fetchText(endpoint, { timeoutMs: TEST_TIMEOUT_MS, retries: 0 });
        setMessage(elements.result, t("inst-connected"));
      } catch (error) {
        setMessage(
          elements.result,
          t("inst-connection-failed", { error: errorMessage(error, t("common-unknown-error")) }),
          {
            error: true,
          }
        );
      }
    });
  });

  elements.cancel.addEventListener("click", reset);
  elements.search.addEventListener("input", render);
  elements.section.addEventListener("toggle", () => {
    fitListToRows(elements.list);
  });

  return { render, reset };
}
