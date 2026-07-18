"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Upload,
  X
} from "lucide-react";
import type {
  V2CardType,
  V2CardTypeFieldType,
  V2XlsxLibraryImportPreview,
  V2XlsxLibraryImportResult,
  V2XlsxLibraryNewFieldInput,
  V2XlsxLibraryWorkbookFile
} from "@yadraw/shared";
import { useDialogFocus } from "../v2-board/use-dialog-focus";
import {
  commitV2XlsxLibraryImport,
  exportV2XlsxLibraryWorkbook,
  previewV2XlsxLibraryImport,
  V2ApiError
} from "./api";

const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const fieldTypeOptions: { value: V2CardTypeFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice" },
  { value: "json", label: "JSON" }
];

type V2XlsxLibraryRoundTripDialogProps = {
  cardType: V2CardType;
  onClose: () => void;
  onImported: (result: V2XlsxLibraryImportResult) => void;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof V2ApiError)) return fallback;
  const body = error.body;
  if (!body || typeof body !== "object" || !("error" in body)) return fallback;
  const apiError = body.error;
  if (!apiError || typeof apiError !== "object" || !("message" in apiError)) return fallback;
  return typeof apiError.message === "string" ? apiError.message : fallback;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return window.btoa(chunks.join(""));
}

function downloadWorkbook(workbook: V2XlsxLibraryWorkbookFile): void {
  const binary = window.atob(workbook.workbookBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: workbook.contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = workbook.filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function expectedPreview(preview: V2XlsxLibraryImportPreview) {
  return {
    fingerprint: preview.fingerprint,
    totalRows: preview.totalRows,
    createRows: preview.createRows,
    updateRows: preview.updateRows,
    unchangedRows: preview.unchangedRows,
    invalidRows: preview.invalidRows,
    newFieldCount: preview.newFieldCount
  };
}

export function V2XlsxLibraryRoundTripDialog({
  cardType,
  onClose,
  onImported
}: V2XlsxLibraryRoundTripDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [workbookBase64, setWorkbookBase64] = useState("");
  const [preview, setPreview] = useState<V2XlsxLibraryImportPreview | null>(null);
  const [fieldTypes, setFieldTypes] = useState<Record<string, V2CardTypeFieldType>>({});
  const [previewIsCurrent, setPreviewIsCurrent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<V2XlsxLibraryImportResult | null>(null);
  const isBusy = isExporting || isPreviewing || isCommitting;

  useDialogFocus(dialogRef, () => {
    if (!isBusy) onClose();
  });

  async function exportWorkbook() {
    if (isBusy) return;
    setIsExporting(true);
    setError(null);
    try {
      const workbook = await exportV2XlsxLibraryWorkbook(cardType.workspaceId, cardType.id);
      downloadWorkbook(workbook);
    } catch (exportError) {
      setError(apiErrorMessage(exportError, "Could not export this library workbook."));
    } finally {
      setIsExporting(false);
    }
  }

  async function runPreview(
    nextFilename = filename,
    nextWorkbookBase64 = workbookBase64,
    newFields: V2XlsxLibraryNewFieldInput[] = []
  ) {
    if (!nextFilename || !nextWorkbookBase64 || isBusy) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const result = await previewV2XlsxLibraryImport(cardType.workspaceId, cardType.id, {
        filename: nextFilename,
        workbookBase64: nextWorkbookBase64,
        newFields
      });
      setPreview(result);
      setFieldTypes((current) => Object.fromEntries(
        result.proposedFields.map((field) => [
          field.columnId,
          field.confirmedType ?? current[field.columnId] ?? field.suggestedType
        ])
      ));
      setPreviewIsCurrent(!result.requiresFieldConfirmation);
      setCompleted(null);
    } catch (previewError) {
      setPreview(null);
      setPreviewIsCurrent(false);
      setError(apiErrorMessage(previewError, "Could not read this Yadraw workbook."));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function selectFile(file: File | null) {
    if (!file || isBusy) return;
    setError(null);
    if (!file.name.toLocaleLowerCase().endsWith(".xlsx")) {
      setError("Choose an .xlsx workbook exported from this Yadraw library.");
      return;
    }
    if (file.size === 0) {
      setError("Choose a non-empty .xlsx workbook.");
      return;
    }
    if (file.size > MAX_XLSX_BYTES) {
      setError("XLSX workbooks cannot exceed 5 MiB.");
      return;
    }
    try {
      const nextWorkbookBase64 = arrayBufferToBase64(await file.arrayBuffer());
      setFilename(file.name);
      setWorkbookBase64(nextWorkbookBase64);
      setPreview(null);
      setFieldTypes({});
      setPreviewIsCurrent(false);
      setCompleted(null);
      await runPreview(file.name, nextWorkbookBase64, []);
    } catch {
      setError("Could not read this .xlsx workbook.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmFieldsAndRefresh() {
    if (!preview || isBusy) return;
    const newFields = preview.proposedFields.map((field) => ({
      columnId: field.columnId,
      type: fieldTypes[field.columnId] ?? field.suggestedType
    }));
    await runPreview(filename, workbookBase64, newFields);
  }

  async function commitImport() {
    if (
      !preview ||
      !previewIsCurrent ||
      preview.requiresFieldConfirmation ||
      preview.invalidRows > 0 ||
      preview.issues.length > 0 ||
      isBusy
    ) return;
    setIsCommitting(true);
    setError(null);
    try {
      const newFields = preview.proposedFields.map((field) => ({
        columnId: field.columnId,
        type: field.confirmedType ?? fieldTypes[field.columnId] ?? field.suggestedType
      }));
      const result = await commitV2XlsxLibraryImport(cardType.workspaceId, cardType.id, {
        filename,
        workbookBase64,
        newFields,
        expectedPreview: expectedPreview(preview)
      });
      setCompleted(result);
      setPreviewIsCurrent(false);
      downloadWorkbook(result.synchronizedWorkbook);
      onImported(result);
    } catch (commitError) {
      setPreviewIsCurrent(false);
      setError(apiErrorMessage(commitError, "Could not apply this library workbook."));
    } finally {
      setIsCommitting(false);
    }
  }

  const visibleIssues = preview?.issues.slice(0, 50) ?? [];
  const canCommit = Boolean(
    preview &&
      previewIsCurrent &&
      !preview.requiresFieldConfirmation &&
      preview.invalidRows === 0 &&
      preview.issues.length === 0 &&
      !isBusy &&
      !completed
  );

  return (
    <div
      ref={dialogRef}
      className="v2CsvImportOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2XlsxRoundTripTitle"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <section className="v2CsvImportDialog" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CsvImportHeader">
          <div>
            <span className="v2CsvImportHeaderIcon" aria-hidden="true"><FileSpreadsheet size={17} /></span>
            <div>
              <h2 id="v2XlsxRoundTripTitle">Edit {cardType.name} library in Excel</h2>
              <p>Round-trip existing records, new rows, and explicitly confirmed fields.</p>
            </div>
          </div>
          <button type="button" aria-label="Close Excel round trip" disabled={isBusy} onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="v2CsvImportBody">
          <section className="v2CsvImportSection v2XlsxImportStep" aria-labelledby="v2XlsxDownloadTitle">
            <div className="v2CsvImportSectionHeading">
              <div>
                <h3 id="v2XlsxDownloadTitle"><span>1</span> Download current library</h3>
                <p>The workbook includes current rows plus hidden IDs and versions. Keep those technical columns unchanged.</p>
              </div>
              <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={() => void exportWorkbook()}>
                {isExporting ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <Download size={14} />}
                <span>{isExporting ? "Preparing…" : "Download library workbook"}</span>
              </button>
            </div>
          </section>

          <section className="v2CsvImportFileSection" aria-label="Edited XLSX workbook">
            <div>
              <strong>{filename || "2  Upload the edited workbook"}</strong>
              <span>.xlsx · up to 5 MiB · 1,000 data rows · formulas are rejected</span>
            </div>
            <input
              ref={fileInputRef}
              className="v2VisuallyHidden"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Choose edited XLSX workbook"
              disabled={isBusy}
              onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
            />
            <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              <span>{workbookBase64 ? "Replace workbook" : "Choose workbook"}</span>
            </button>
          </section>

          {completed ? (
            <section className="v2XlsxImportSuccess" role="status">
              <CheckCircle2 size={22} />
              <div>
                <strong>Library synchronized</strong>
                <span>
                  {completed.createdCount} created · {completed.updatedCount} updated · {completed.addedFieldCount} fields added
                </span>
                <p>The synchronized workbook was downloaded with current IDs and versions. Use it for the next round trip.</p>
              </div>
              <button type="button" className="v2SchemaEditButton" onClick={() => downloadWorkbook(completed.synchronizedWorkbook)}>
                <Download size={14} />
                <span>Download again</span>
              </button>
            </section>
          ) : preview ? (
            <>
              {preview.proposedFields.length > 0 ? (
                <section className="v2CsvImportSection" aria-labelledby="v2XlsxFieldsTitle">
                  <div className="v2CsvImportSectionHeading">
                    <div>
                      <h3 id="v2XlsxFieldsTitle">3  Confirm new fields</h3>
                      <p>Each new workbook column changes this card type across the workspace. New fields stay optional.</p>
                    </div>
                    {!previewIsCurrent ? <span>Confirmation required</span> : null}
                  </div>
                  <div className="v2XlsxImportFieldGrid">
                    {preview.proposedFields.map((field) => (
                      <label key={field.columnId}>
                        <span>{field.header}</span>
                        <select
                          value={fieldTypes[field.columnId] ?? field.suggestedType}
                          disabled={isBusy}
                          aria-label={`Type for new field ${field.header}`}
                          onChange={(event) => {
                            setFieldTypes((current) => ({
                              ...current,
                              [field.columnId]: event.target.value as V2CardTypeFieldType
                            }));
                            setPreviewIsCurrent(false);
                            setError(null);
                          }}
                        >
                          {fieldTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <small>
                          Key: {field.fieldKey} · {field.distinctValueCount} distinct
                          {field.sampleValues.length ? ` · ${field.sampleValues.join(", ")}` : ""}
                        </small>
                      </label>
                    ))}
                  </div>
                  <p className="v2CsvImportWarning"><AlertTriangle size={14} /> Existing linked cards use the updated canonical records immediately.</p>
                  <div className="v2XlsxImportReviewAction">
                    <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={() => void confirmFieldsAndRefresh()}>
                      {isPreviewing ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <RefreshCw size={14} />}
                      <span>{isPreviewing ? "Reviewing…" : "Confirm fields and review changes"}</span>
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="v2CsvImportSection" aria-labelledby="v2XlsxPreviewTitle">
                <div className="v2CsvImportSectionHeading">
                  <div>
                    <h3 id="v2XlsxPreviewTitle">4  Review changes</h3>
                    <p>Missing workbook rows never delete records. Missing existing field columns preserve their values.</p>
                  </div>
                  {!previewIsCurrent && preview.proposedFields.length === 0 ? <span>Preview needs refresh</span> : null}
                </div>
                <div className="v2CsvImportCounts v2XlsxImportCounts" aria-live="polite">
                  <span><strong>{preview.createRows}</strong>Create</span>
                  <span><strong>{preview.updateRows}</strong>Update</span>
                  <span><strong>{preview.unchangedRows}</strong>Unchanged</span>
                  <span><strong>{preview.newFieldCount}</strong>New fields</span>
                  <span className={preview.invalidRows > 0 ? "v2CsvImportCountInvalid" : ""}><strong>{preview.invalidRows}</strong>Invalid</span>
                </div>
                {preview.warnings.map((warning) => <p key={warning} className="v2CsvImportWarning"><AlertTriangle size={14} />{warning}</p>)}
                {visibleIssues.length > 0 ? (
                  <div className="v2CsvImportIssues" role="alert">
                    <strong>Resolve these issues before applying the workbook</strong>
                    <ul>
                      {visibleIssues.map((issue, index) => (
                        <li key={`${issue.rowNumber ?? "all"}:${issue.columnId ?? "all"}:${index}`}>
                          {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}{issue.message}
                        </li>
                      ))}
                    </ul>
                    {preview.issues.length > visibleIssues.length ? <span>{preview.issues.length - visibleIssues.length} more issues</span> : null}
                  </div>
                ) : null}
                <div className="v2CsvImportTableWrap">
                  <table>
                    <thead><tr><th>Row</th><th>Result</th><th>Name</th><th>Issues</th></tr></thead>
                    <tbody>
                      {preview.previewRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td><span className={`v2CsvImportStatus v2CsvImportStatus-${row.status}`}>{row.status}</span></td>
                          <td title={row.title}>{row.title || "—"}</td>
                          <td title={row.issues.join("\n")}>{row.issues.join(" · ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.proposedFields.length === 0 && !previewIsCurrent ? (
                  <div className="v2XlsxImportReviewAction">
                    <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={() => void runPreview()}>
                      <RefreshCw size={14} /><span>Refresh preview</span>
                    </button>
                  </div>
                ) : null}
              </section>
            </>
          ) : isPreviewing ? (
            <div className="v2CsvImportLoading"><LoaderCircle size={18} className="v2CardLibrarySpinner" /><span>Reading and validating workbook…</span></div>
          ) : (
            <div className="v2CsvImportEmpty"><FileSpreadsheet size={24} /><span>Download the current library, edit it, then upload the .xlsx workbook.</span></div>
          )}

          {error ? <p className="v2CsvImportError" role="alert">{error}</p> : null}
        </div>

        <footer className="v2CsvImportFooter">
          <span>No board cards, connections, attachments, or deletions will be created.</span>
          <div>
            <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={onClose}>{completed ? "Close" : "Cancel"}</button>
            {!completed ? (
              <button type="button" className="v2InspectorPrimaryAction" disabled={!canCommit} onClick={() => void commitImport()}>
                {isCommitting ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <Upload size={14} />}
                <span>{isCommitting ? "Applying…" : "Apply workbook"}</span>
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}
