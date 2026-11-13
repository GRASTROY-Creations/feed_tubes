import { createEl, createOption, getElement, setMessage } from "../../../lib/dom.js";
import { errorMessage } from "../../../lib/errors.js";
import {
  EXPORT_FORMATS,
  exportSubscriptions,
  isExportFormat,
  parseSubscriptionsFile,
  type ImportResult,
} from "../../../lib/import-export.js";
import { missingOrigins } from "../../../lib/permissions.js";
import { isMergeMode, mergeSubscriptions } from "../../../lib/subscriptions.js";
import type { AppContext } from "../../app-context.js";
import { showError, showToast } from "../../components/toast.js";
import { withDisabled, type SettingsSection } from "./shared.js";
import { t } from "../../../lib/i18n/index.js";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const OBJECT_URL_LIFETIME_MS = 1000;

function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = createEl("a", {
    className: "hidden-download",
    attrs: { href: url, download: filename },
  });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, OBJECT_URL_LIFETIME_MS);
}

/** One sentence per line: what was imported, skipped, and stored. */
function importReport(parsed: ImportResult, storedCount: number): string[] {
  const details = [
    t("transfer-imported", { count: parsed.subscriptions.length, format: parsed.format }),
  ];
  if (parsed.invalid.length > 0) {
    details.push(t("transfer-invalid-rows", { count: parsed.invalid.length }));
  }
  if (parsed.warnings.length > 0) {
    details.push(...parsed.warnings);
  }
  if (storedCount !== parsed.subscriptions.length) {
    details.push(t("transfer-stored", { count: storedCount }));
  }
  return details;
}

/** Import and export of subscription files. */
export function initTransferSection(app: AppContext): SettingsSection {
  const elements = {
    section: getElement("settings-transfer", HTMLDetailsElement),
    importFile: getElement("import-file", HTMLInputElement),
    importMode: getElement("import-mode", HTMLSelectElement),
    importButton: getElement("import-button", HTMLButtonElement),
    importReport: getElement("import-report", HTMLParagraphElement),
    importGrant: getElement("import-grant", HTMLButtonElement),
    exportFormat: getElement("export-format", HTMLSelectElement),
    exportScope: getElement("export-scope", HTMLSelectElement),
    exportButton: getElement("export-button", HTMLButtonElement),
  };

  const reportError = (message: string): void => {
    setMessage(elements.importReport, message, { error: true });
  };

  async function importFile(file: File): Promise<void> {
    setMessage(elements.importReport, t("transfer-importing"));

    try {
      const parsed = parseSubscriptionsFile(await file.text(), file.name);
      if (parsed.subscriptions.length === 0) {
        reportError(t("transfer-none-found"));
        return;
      }

      const mode = isMergeMode(elements.importMode.value) ? elements.importMode.value : "merge";
      const current = app.state.subscriptions;
      if (
        mode === "replace" &&
        current.length > 0 &&
        !window.confirm(t("transfer-confirm-replace"))
      ) {
        setMessage(elements.importReport, "");
        return;
      }

      const next = mergeSubscriptions(current, parsed.subscriptions, mode);
      await app.persistSubscriptions(next);
      elements.importFile.value = "";

      // The access prompt needs a fresh click: the one on "Import" was used up by reading
      // the file. Without access, every imported source would fail on the next refresh.
      const missing = await missingOrigins(next.filter((subscription) => subscription.enabled));
      const report = importReport(parsed, next.length);
      if (missing.length > 0) {
        report.push(t("transfer-access-needed"));
      }
      setMessage(elements.importReport, report);
      elements.importGrant.hidden = missing.length === 0;
      showToast(t("transfer-imported-toast"));
    } catch (error) {
      reportError(errorMessage(error, t("transfer-import-failed")));
    }
  }

  elements.importButton.addEventListener("click", () => {
    const file = elements.importFile.files?.[0];
    if (!file) {
      reportError(t("transfer-choose-file"));
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      reportError(t("transfer-too-large"));
      return;
    }
    void withDisabled(elements.importButton, () => importFile(file));
  });

  elements.importGrant.addEventListener("click", () => {
    // `requestPermissions` is called before any await, while the click still counts.
    const access = app.requestPermissions();
    void withDisabled(elements.importGrant, async () => {
      try {
        if (!(await access)) {
          showError(t("feed-toast-access-denied"));
          return;
        }
        elements.importGrant.hidden = true;
        showToast(t("feed-toast-access-granted"));
        await app.refresh({ manual: true });
      } catch {
        showError(t("feed-toast-access-failed"));
      }
    });
  });

  elements.exportButton.addEventListener("click", () => {
    const format = elements.exportFormat.value;
    const scope = elements.exportScope.value === "enabled" ? "enabled" : "all";
    if (!isExportFormat(format)) {
      showError(t("transfer-choose-format"));
      return;
    }

    try {
      const output = exportSubscriptions(format, app.state.subscriptions, scope);
      downloadText(output.filename, output.text, output.mime);
      showToast(t("transfer-exported", { filename: output.filename }));
    } catch (error) {
      showError(errorMessage(error, t("transfer-export-failed")));
    }
  });

  elements.exportFormat.replaceChildren(
    ...EXPORT_FORMATS.map((format) => createOption(format.id, format.label))
  );
  elements.exportFormat.value = "unified-csv";

  // Without subscriptions, importing a file is the likely first step, so the section opens
  // whenever the list becomes empty (first run, or after "Reset all data"). It only reacts to
  // that change, so closing it while the list is still empty keeps it closed.
  let hadSubscriptions = true;

  return {
    render() {
      const hasSubscriptions = app.state.subscriptions.length > 0;
      if (hadSubscriptions && !hasSubscriptions) {
        elements.section.open = true;
      }
      hadSubscriptions = hasSubscriptions;
    },
  };
}
