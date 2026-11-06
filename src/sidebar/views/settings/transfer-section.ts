import { createEl, createOption, getElement, setMessage } from "../../../lib/dom.js";
import { errorMessage } from "../../../lib/errors.js";
import {
  EXPORT_FORMATS,
  exportSubscriptions,
  isExportFormat,
  parseSubscriptionsFile,
  type ImportResult,
} from "../../../lib/import-export.js";
import { isMergeMode, mergeSubscriptions } from "../../../lib/subscriptions.js";
import type { AppContext } from "../../app-context.js";
import { showError, showToast } from "../../components/toast.js";
import { withDisabled, type SettingsSection } from "./shared.js";

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

function importReport(parsed: ImportResult, storedCount: number): string {
  const details = [
    `Imported ${parsed.subscriptions.length} subscription(s) from ${parsed.format}.`,
  ];
  if (parsed.invalid.length > 0) {
    details.push(`${parsed.invalid.length} invalid row(s) skipped.`);
  }
  if (parsed.warnings.length > 0) {
    details.push(parsed.warnings.join(" "));
  }
  if (storedCount !== parsed.subscriptions.length) {
    details.push(`${storedCount} subscription(s) stored.`);
  }
  return details.join(" ");
}

/** Import and export of subscription files. */
export function initTransferSection(app: AppContext): SettingsSection {
  const elements = {
    section: getElement("settings-transfer", HTMLDetailsElement),
    importFile: getElement("import-file", HTMLInputElement),
    importMode: getElement("import-mode", HTMLSelectElement),
    importButton: getElement("import-button", HTMLButtonElement),
    importReport: getElement("import-report", HTMLParagraphElement),
    exportFormat: getElement("export-format", HTMLSelectElement),
    exportScope: getElement("export-scope", HTMLSelectElement),
    exportButton: getElement("export-button", HTMLButtonElement),
  };

  const reportError = (message: string): void => {
    setMessage(elements.importReport, message, { error: true });
  };

  async function importFile(file: File): Promise<void> {
    setMessage(elements.importReport, "Importing…");

    try {
      const parsed = parseSubscriptionsFile(await file.text(), file.name);
      if (parsed.subscriptions.length === 0) {
        reportError("No valid subscriptions were found.");
        return;
      }

      const mode = isMergeMode(elements.importMode.value) ? elements.importMode.value : "merge";
      const current = app.state.subscriptions;
      if (
        mode === "replace" &&
        current.length > 0 &&
        !window.confirm("Replace all existing subscriptions with this file?")
      ) {
        setMessage(elements.importReport, "");
        return;
      }

      const next = mergeSubscriptions(current, parsed.subscriptions, mode);
      await app.persistSubscriptions(next);
      elements.importFile.value = "";
      setMessage(elements.importReport, importReport(parsed, next.length));
      showToast("Subscriptions imported.");
    } catch (error) {
      reportError(errorMessage(error, "Could not import the file."));
    }
  }

  elements.importButton.addEventListener("click", () => {
    const file = elements.importFile.files?.[0];
    if (!file) {
      reportError("Choose a subscription file first.");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      reportError("The file is larger than the 5 MB limit.");
      return;
    }
    void withDisabled(elements.importButton, () => importFile(file));
  });

  elements.exportButton.addEventListener("click", () => {
    const format = elements.exportFormat.value;
    const scope = elements.exportScope.value === "enabled" ? "enabled" : "all";
    if (!isExportFormat(format)) {
      showError("Choose an export format.");
      return;
    }

    try {
      const output = exportSubscriptions(format, app.state.subscriptions, scope);
      downloadText(output.filename, output.text, output.mime);
      showToast(`Exported ${output.filename}.`);
    } catch (error) {
      showError(errorMessage(error, "Could not export subscriptions."));
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
