"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  Upload,
  X
} from "lucide-react";
import type {
  V2CardType,
  V2CsvLibraryImportColumnMapping,
  V2CsvLibraryImportDuplicatePolicy,
  V2CsvLibraryImportPreview,
  V2CsvLibraryImportResult
} from "@yadraw/shared";
import { useDialogFocus } from "../v2-board/use-dialog-focus";
import {
  commitV2CsvLibraryImport,
  previewV2CsvLibraryImport,
  V2ApiError
} from "./api";

const MAX_CSV_BYTES = 1024 * 1024;

type DuplicateMode = V2CsvLibraryImportDuplicatePolicy["mode"];

type V2CsvLibraryImportDialogProps = {
  cardType: V2CardType;
  onClose: () => void;
  onImported: (result: V2CsvLibraryImportResult) => void;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof V2ApiError)) return fallback;
  const body = error.body;
  if (!body || typeof body !== "object" || !("error" in body)) return fallback;
  const apiError = body.error;
  if (!apiError || typeof apiError !== "object" || !("message" in apiError)) return fallback;
  return typeof apiError.message === "string" ? apiError.message : fallback;
}

function targetValue(mapping: V2CsvLibraryImportColumnMapping): string {
  return mapping.target.kind === "field"
    ? `field:${mapping.target.fieldKey}`
    : mapping.target.kind;
}

function mappingWithTarget(
  mapping: V2CsvLibraryImportColumnMapping,
  value: string
): V2CsvLibraryImportColumnMapping {
  if (value.startsWith("field:")) {
    return {
      sourceHeader: mapping.sourceHeader,
      target: { kind: "field", fieldKey: value.slice("field:".length) }
    };
  }
  return {
    sourceHeader: mapping.sourceHeader,
    target: { kind: value as "ignore" | "title" | "description" }
  };
}

function duplicatePolicy(
  mode: DuplicateMode,
  keyValue: string
): V2CsvLibraryImportDuplicatePolicy {
  if (mode === "create_new") return { mode };
  const key = keyValue.startsWith("field:")
    ? { kind: "field" as const, fieldKey: keyValue.slice("field:".length) }
    : { kind: "title" as const };
  return { mode, key };
}

function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function V2CsvLibraryImportDialog({
  cardType,
  onClose,
  onImported
}: V2CsvLibraryImportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<V2CsvLibraryImportColumnMapping[]>([]);
  const [mode, setMode] = useState<DuplicateMode>("create_new");
  const [duplicateKey, setDuplicateKey] = useState("title");
  const [preview, setPreview] = useState<V2CsvLibraryImportPreview | null>(null);
  const [previewIsCurrent, setPreviewIsCurrent] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBusy = isPreviewing || isCommitting;

  useDialogFocus(dialogRef, () => {
    if (!isBusy) onClose();
  });

  const mappedDuplicateKeys = useMemo(() => {
    const values: { value: string; label: string }[] = [];
    if (mapping.some((item) => item.target.kind === "title")) {
      values.push({ value: "title", label: "Entry name" });
    }
    for (const field of cardType.schema.fields) {
      if (
        field.type !== "json" &&
        mapping.some(
          (item) => item.target.kind === "field" && item.target.fieldKey === field.key
        )
      ) {
        values.push({ value: `field:${field.key}`, label: field.label });
      }
    }
    return values;
  }, [cardType.schema.fields, mapping]);

  async function runPreview(
    nextCsv = csv,
    nextMapping = mapping,
    nextMode = mode,
    nextDuplicateKey = duplicateKey
  ) {
    if (!nextCsv || isBusy) return;
    setIsPreviewing(true);
    setError(null);
    try {
      const result = await previewV2CsvLibraryImport(cardType.workspaceId, cardType.id, {
        csv: nextCsv,
        mapping: nextMapping,
        duplicatePolicy: duplicatePolicy(nextMode, nextDuplicateKey)
      });
      setPreview(result);
      setMapping(result.mapping);
      setPreviewIsCurrent(true);
      const availableKeys = [
        ...(result.mapping.some((item) => item.target.kind === "title") ? ["title"] : []),
        ...cardType.schema.fields
          .filter(
            (field) =>
              field.type !== "json" &&
              result.mapping.some(
                (item) => item.target.kind === "field" && item.target.fieldKey === field.key
              )
          )
          .map((field) => `field:${field.key}`)
      ];
      if (!availableKeys.includes(nextDuplicateKey) && availableKeys[0]) {
        setDuplicateKey(availableKeys[0]);
        if (nextMode !== "create_new") setPreviewIsCurrent(false);
      }
    } catch (previewError) {
      setPreviewIsCurrent(false);
      setError(apiErrorMessage(previewError, "Could not preview this CSV file."));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function selectFile(file: File | null) {
    if (!file || isBusy) return;
    setError(null);
    if (file.size > MAX_CSV_BYTES) {
      setError("CSV files cannot exceed 1 MiB.");
      return;
    }
    try {
      const nextCsv = await file.text();
      if (!nextCsv) {
        setError("Choose a non-empty CSV file.");
        return;
      }
      setCsv(nextCsv);
      setFilename(file.name);
      setMapping([]);
      setMode("create_new");
      setDuplicateKey("title");
      setPreview(null);
      setPreviewIsCurrent(false);
      await runPreview(nextCsv, [], "create_new", "title");
    } catch {
      setError("Could not read this CSV file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateMapping(index: number, value: string) {
    setMapping((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? mappingWithTarget(item, value) : item
      )
    );
    setPreviewIsCurrent(false);
    setError(null);
  }

  async function commitImport() {
    if (!preview || !previewIsCurrent || preview.invalidRows > 0 || preview.issues.length > 0 || isBusy) {
      return;
    }
    setIsCommitting(true);
    setError(null);
    try {
      const result = await commitV2CsvLibraryImport(cardType.workspaceId, cardType.id, {
        csv,
        mapping,
        duplicatePolicy: duplicatePolicy(mode, duplicateKey),
        expectedPreview: {
          fingerprint: preview.fingerprint,
          totalRows: preview.totalRows,
          createRows: preview.createRows,
          updateRows: preview.updateRows,
          skippedRows: preview.skippedRows,
          invalidRows: preview.invalidRows
        }
      });
      onImported(result);
    } catch (commitError) {
      setPreviewIsCurrent(false);
      setError(apiErrorMessage(commitError, "Could not import this CSV file."));
    } finally {
      setIsCommitting(false);
    }
  }

  const canCommit = Boolean(
    preview &&
      previewIsCurrent &&
      preview.invalidRows === 0 &&
      preview.issues.length === 0 &&
      !isBusy
  );
  const visibleIssues = preview?.issues.slice(0, 50) ?? [];

  return (
    <div
      ref={dialogRef}
      className="v2CsvImportOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2CsvImportTitle"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <section className="v2CsvImportDialog" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CsvImportHeader">
          <div>
            <span className="v2CsvImportHeaderIcon" aria-hidden="true"><FileSpreadsheet size={17} /></span>
            <div>
              <h2 id="v2CsvImportTitle">Import CSV into {cardType.name} library</h2>
              <p>Create reusable records without adding cards to the board.</p>
            </div>
          </div>
          <button type="button" aria-label="Close CSV import" disabled={isBusy} onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="v2CsvImportBody">
          <section className="v2CsvImportFileSection" aria-label="CSV file">
            <div>
              <strong>{filename || "Choose a CSV file"}</strong>
              <span>UTF-8 · comma or semicolon · up to 1 MiB · 500 data rows</span>
            </div>
            <input
              ref={fileInputRef}
              className="v2VisuallyHidden"
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose CSV file"
              disabled={isBusy}
              onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
            />
            <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              <span>{csv ? "Replace file" : "Choose file"}</span>
            </button>
          </section>

          {preview ? (
            <>
              <section className="v2CsvImportSection" aria-labelledby="v2CsvMappingTitle">
                <div className="v2CsvImportSectionHeading">
                  <div>
                    <h3 id="v2CsvMappingTitle">Map columns</h3>
                    <p>Every CSV column must be mapped or ignored. Entry name is required.</p>
                  </div>
                  {!previewIsCurrent ? <span>Preview needs refresh</span> : null}
                </div>
                <div className="v2CsvImportMapping">
                  {mapping.map((item, index) => (
                    <label key={item.sourceHeader}>
                      <span>{item.sourceHeader}</span>
                      <select
                        value={targetValue(item)}
                        disabled={isBusy}
                        aria-label={`Map ${item.sourceHeader}`}
                        onChange={(event) => updateMapping(index, event.target.value)}
                      >
                        <option value="ignore">Ignore</option>
                        <option value="title">Entry name</option>
                        <option value="description">Description</option>
                        {cardType.schema.fields.map((field) => (
                          <option key={field.key} value={`field:${field.key}`}>
                            {field.label}{field.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                      <small title={preview.previewRows[0]?.values[item.sourceHeader] ?? ""}>
                        {preview.previewRows[0]?.values[item.sourceHeader] || "Empty sample"}
                      </small>
                    </label>
                  ))}
                </div>
              </section>

              <section className="v2CsvImportSection" aria-labelledby="v2CsvDuplicatesTitle">
                <div className="v2CsvImportSectionHeading">
                  <div>
                    <h3 id="v2CsvDuplicatesTitle">Repeated imports</h3>
                    <p>Choose what happens when the same record is imported again.</p>
                  </div>
                </div>
                <div className="v2CsvImportDuplicateControls">
                  <label>
                    <span>Action</span>
                    <select
                      value={mode}
                      disabled={isBusy}
                      onChange={(event) => {
                        setMode(event.target.value as DuplicateMode);
                        setPreviewIsCurrent(false);
                        setError(null);
                      }}
                    >
                      <option value="create_new">Create every row</option>
                      <option value="skip_existing">Skip existing records</option>
                      <option value="update_existing">Update existing records</option>
                    </select>
                  </label>
                  {mode !== "create_new" ? (
                    <label>
                      <span>Match by</span>
                      <select
                        value={duplicateKey}
                        disabled={isBusy || mappedDuplicateKeys.length === 0}
                        onChange={(event) => {
                          setDuplicateKey(event.target.value);
                          setPreviewIsCurrent(false);
                          setError(null);
                        }}
                      >
                        {mappedDuplicateKeys.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="v2SchemaEditButton"
                    disabled={isBusy || !csv}
                    onClick={() => void runPreview()}
                  >
                    {isPreviewing ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <RefreshCw size={14} />}
                    <span>{isPreviewing ? "Previewing…" : "Refresh preview"}</span>
                  </button>
                </div>
                {mode === "update_existing" ? (
                  <p className="v2CsvImportWarning"><AlertTriangle size={14} /> Updating a library record immediately updates cards linked to it.</p>
                ) : null}
              </section>

              <section className="v2CsvImportSection" aria-labelledby="v2CsvPreviewTitle">
                <div className="v2CsvImportSectionHeading">
                  <div>
                    <h3 id="v2CsvPreviewTitle">Preview</h3>
                    <p>{countLabel(preview.totalRows, "data row")} found in the file.</p>
                  </div>
                </div>
                <div className="v2CsvImportCounts" aria-live="polite">
                  <span><strong>{preview.createRows}</strong>Create</span>
                  <span><strong>{preview.updateRows}</strong>Update</span>
                  <span><strong>{preview.skippedRows}</strong>Skip</span>
                  <span className={preview.invalidRows > 0 ? "v2CsvImportCountInvalid" : ""}><strong>{preview.invalidRows}</strong>Invalid</span>
                </div>
                {visibleIssues.length > 0 ? (
                  <div className="v2CsvImportIssues" role="alert">
                    <strong>Resolve these issues before importing</strong>
                    <ul>
                      {visibleIssues.map((issue, index) => (
                        <li key={`${issue.rowNumber ?? "all"}:${issue.sourceHeader ?? "all"}:${index}`}>
                          {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}{issue.message}
                        </li>
                      ))}
                    </ul>
                    {preview.issues.length > visibleIssues.length ? <span>{preview.issues.length - visibleIssues.length} more issues</span> : null}
                  </div>
                ) : null}
                <div className="v2CsvImportTableWrap">
                  <table>
                    <thead><tr><th>Row</th><th>Result</th>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                    <tbody>
                      {preview.previewRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          <td><span className={`v2CsvImportStatus v2CsvImportStatus-${row.status}`}>{row.status}</span></td>
                          {preview.headers.map((header) => <td key={header} title={row.values[header] ?? ""}>{row.values[header] || "—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : isPreviewing ? (
            <div className="v2CsvImportLoading"><LoaderCircle size={18} className="v2CardLibrarySpinner" /><span>Reading and validating CSV…</span></div>
          ) : (
            <div className="v2CsvImportEmpty"><FileSpreadsheet size={24} /><span>Choose a CSV file to map and preview its rows.</span></div>
          )}

          {error ? <p className="v2CsvImportError" role="alert">{error}</p> : null}
        </div>

        <footer className="v2CsvImportFooter">
          <span>No cards, connections, or attachments will be created.</span>
          <div>
            <button type="button" className="v2SchemaEditButton" disabled={isBusy} onClick={onClose}>Cancel</button>
            <button type="button" className="v2InspectorPrimaryAction" disabled={!canCommit} onClick={() => void commitImport()}>
              {isCommitting ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <Upload size={14} />}
              <span>{isCommitting ? "Importing…" : "Import library records"}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
