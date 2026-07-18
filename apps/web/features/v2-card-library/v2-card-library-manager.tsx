"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  AlertTriangle,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  V2CardLibraryEntry,
  V2CardType,
  V2CardTypeFieldSchema,
} from "@yadraw/shared";
import { useDialogFocus } from "../v2-board/use-dialog-focus";
import { getV2CardTypeIcon } from "../v2-board/v2-card-type-icons";
import { resolveCardTypeAccentKey } from "../v2-board/v2-theme-tokens";
import {
  createV2CardLibraryEntry,
  deleteV2CardLibraryEntry,
  getV2CardLibraryEntry,
  listV2CardLibraryEntries,
  updateV2CardLibraryEntry,
  V2ApiError,
} from "./api";
import { V2CsvLibraryImportDialog } from "./v2-csv-library-import-dialog";
import { V2XlsxLibraryRoundTripDialog } from "./v2-xlsx-library-round-trip-dialog";

type LibraryStatusFilter = "active" | "archived" | "all";

type LibraryRowDraft = {
  title: string;
  description: string;
  fieldValues: Record<string, string>;
};

type PreparedLibraryRow = {
  title: string;
  description: string;
  data: Record<string, unknown>;
};

type V2CardLibraryRowHandle = {
  flush: () => Promise<boolean>;
};

type V2CardLibraryRowProps = {
  rowKey: string;
  workspaceId: string;
  cardType: V2CardType;
  entry: V2CardLibraryEntry | null;
  onEntrySaved: (rowKey: string, entry: V2CardLibraryEntry) => void;
  onEntryDeleted: (rowKey: string) => void;
  onRemoveDraft: (rowKey: string) => void;
};

type V2CardLibraryManagerProps = {
  cardTypes: V2CardType[];
  initialCardTypeId: string;
  onBack: (cardTypeId: string) => void;
  onClose: () => void;
};

function createLocalRowId(): string {
  if (globalThis.crypto?.randomUUID) return `new:${globalThis.crypto.randomUUID()}`;
  return `new:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function valueToInput(field: V2CardTypeFieldSchema, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (field.type === "boolean") {
    if (value === true) return "true";
    if (value === false) return "false";
    return "";
  }
  if (field.type === "json") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  if (field.type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  }
  return typeof value === "string" ? value : "";
}

function draftFromEntry(
  cardType: V2CardType,
  entry: V2CardLibraryEntry | null
): LibraryRowDraft {
  const fieldValues: Record<string, string> = {};
  for (const field of cardType.schema.fields) {
    const value = entry ? entry.data[field.key] : field.defaultValue;
    fieldValues[field.key] = valueToInput(field, value);
  }
  return {
    title: entry?.title ?? "",
    description: entry?.description ?? "",
    fieldValues,
  };
}

function serializeDraft(draft: LibraryRowDraft): string {
  return JSON.stringify(draft);
}

function draftHasContent(draft: LibraryRowDraft): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.description.trim() ||
      Object.values(draft.fieldValues).some((value) => value.trim())
  );
}

function prepareDraft(
  cardType: V2CardType,
  draft: LibraryRowDraft
): { ok: true; value: PreparedLibraryRow } | { ok: false; error: string } {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: "Name is required." };

  const data: Record<string, unknown> = {};
  for (const field of cardType.schema.fields) {
    const input = draft.fieldValues[field.key] ?? "";
    if (input.trim() === "") continue;

    if (field.type === "number") {
      const value = Number(input);
      if (!Number.isFinite(value)) {
        return { ok: false, error: `${field.label} must be a number.` };
      }
      data[field.key] = value;
      continue;
    }
    if (field.type === "boolean") {
      if (input !== "true" && input !== "false") continue;
      data[field.key] = input === "true";
      continue;
    }
    if (field.type === "json") {
      try {
        data[field.key] = JSON.parse(input) as unknown;
      } catch {
        return { ok: false, error: `${field.label} must contain valid JSON.` };
      }
      continue;
    }
    data[field.key] = input;
  }

  return {
    ok: true,
    value: { title, description: draft.description, data },
  };
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof V2ApiError)) return fallback;
  const body = error.body;
  if (!body || typeof body !== "object" || !("error" in body)) return fallback;
  const apiError = body.error;
  if (!apiError || typeof apiError !== "object" || !("message" in apiError)) return fallback;
  return typeof apiError.message === "string" ? apiError.message : fallback;
}

function entryMatchesFilter(
  entry: V2CardLibraryEntry,
  status: LibraryStatusFilter,
  query: string
): boolean {
  const statusMatches =
    status === "all" ||
    (status === "active" ? entry.archivedAt === null : entry.archivedAt !== null);
  if (!statusMatches) return false;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  return `${entry.title}\n${entry.description}`.toLocaleLowerCase().includes(normalizedQuery);
}

function LibraryFieldInput({
  field,
  value,
  disabled,
  invalid,
  onChange,
}: {
  field: V2CardTypeFieldSchema;
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const commonProps = {
    className: "v2CardLibraryCellInput",
    disabled,
    "aria-label": field.label,
    "aria-invalid": invalid || undefined,
  } as const;

  if (field.type === "boolean") {
    return (
      <select {...commonProps} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (field.type === "select") {
    return (
      <select {...commonProps} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "json") {
    return (
      <textarea
        {...commonProps}
        className={`${commonProps.className} v2CardLibraryJsonInput`}
        value={value}
        rows={1}
        placeholder={field.placeholder ?? "JSON"}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <input
      {...commonProps}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      step={field.type === "number" ? "any" : undefined}
      value={value}
      placeholder={field.placeholder ?? "—"}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const V2CardLibraryRow = forwardRef<V2CardLibraryRowHandle, V2CardLibraryRowProps>(
  function V2CardLibraryRow(
    {
      rowKey,
      workspaceId,
      cardType,
      entry,
      onEntrySaved,
      onEntryDeleted,
      onRemoveDraft,
    },
    ref
  ) {
    const initialDraft = useMemo(() => draftFromEntry(cardType, entry), [cardType, entry]);
    const [draft, setDraft] = useState<LibraryRowDraft>(initialDraft);
    const [baseline, setBaseline] = useState<LibraryRowDraft>(initialDraft);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const draftRef = useRef(draft);
    const baselineRef = useRef(baseline);
    const entryIdRef = useRef(entry?.id ?? null);
    const versionRef = useRef(entry?.version ?? null);
    const savingPromiseRef = useRef<Promise<boolean> | null>(null);
    const conflictBlockedRef = useRef(false);
    const isDirty = serializeDraft(draft) !== serializeDraft(baseline);
    const dirtyRef = useRef(isDirty);
    dirtyRef.current = isDirty;

    function replaceDraft(nextDraft: LibraryRowDraft) {
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    }

    function updateDraft(patch: Partial<Omit<LibraryRowDraft, "fieldValues">>) {
      const nextDraft = { ...draftRef.current, ...patch };
      replaceDraft(nextDraft);
      conflictBlockedRef.current = false;
      setError(null);
    }

    function updateField(fieldKey: string, value: string) {
      const nextDraft = {
        ...draftRef.current,
        fieldValues: { ...draftRef.current.fieldValues, [fieldKey]: value },
      };
      replaceDraft(nextDraft);
      conflictBlockedRef.current = false;
      setError(null);
    }

    const commitDraft = useCallback(
      async (archived?: boolean): Promise<boolean> => {
        if (savingPromiseRef.current) {
          await savingPromiseRef.current;
          return commitDraft(archived);
        }
        if (conflictBlockedRef.current) return false;

        const currentDraft = draftRef.current;
        const currentEntryId = entryIdRef.current;
        const changed = serializeDraft(currentDraft) !== serializeDraft(baselineRef.current);
        if (!currentEntryId && !currentDraft.title.trim()) {
          if (!draftHasContent(currentDraft)) return true;
          setError("Name is required before this row can be saved.");
          return false;
        }
        if (!changed && archived === undefined) return true;

        const prepared = prepareDraft(cardType, currentDraft);
        if (!prepared.ok) {
          setError(prepared.error);
          return false;
        }

        setIsSaving(true);
        setError(null);
        const request = (async () => {
          try {
            const saved = currentEntryId
              ? await updateV2CardLibraryEntry(
                  workspaceId,
                  cardType.id,
                  currentEntryId,
                  {
                    ...prepared.value,
                    ...(archived === undefined ? {} : { archived }),
                    expectedVersion: versionRef.current ?? 1,
                  }
                )
              : await createV2CardLibraryEntry(workspaceId, cardType.id, prepared.value);

            entryIdRef.current = saved.id;
            versionRef.current = saved.version;
            conflictBlockedRef.current = false;
            baselineRef.current = currentDraft;
            setBaseline(currentDraft);
            onEntrySaved(rowKey, saved);
            return true;
          } catch (saveError) {
            if (
              currentEntryId &&
              saveError instanceof V2ApiError &&
              saveError.status === 409
            ) {
              try {
                const latest = await getV2CardLibraryEntry(
                  workspaceId,
                  cardType.id,
                  currentEntryId
                );
                const latestDraft = draftFromEntry(cardType, latest);
                versionRef.current = latest.version;
                baselineRef.current = latestDraft;
                setBaseline(latestDraft);
                onEntrySaved(rowKey, latest);
                if (serializeDraft(currentDraft) === serializeDraft(latestDraft)) {
                  conflictBlockedRef.current = false;
                  setError(null);
                } else {
                  conflictBlockedRef.current = true;
                  setError("This row changed elsewhere. Review it and edit any value to retry.");
                }
                return false;
              } catch {
                conflictBlockedRef.current = true;
              }
            }
            setError(
              apiErrorMessage(
                saveError,
                saveError instanceof V2ApiError && saveError.status === 409
                  ? "This row changed elsewhere. Reload the library and try again."
                  : "Could not save this library row."
              )
            );
            return false;
          } finally {
            setIsSaving(false);
            savingPromiseRef.current = null;
          }
        })();
        savingPromiseRef.current = request;
        return request;
      },
      [cardType, onEntrySaved, rowKey, workspaceId]
    );

    useImperativeHandle(ref, () => ({ flush: () => commitDraft() }), [commitDraft]);

    useEffect(() => {
      if (!entry) return;
      if (entry.id === entryIdRef.current && entry.version <= (versionRef.current ?? 0)) return;
      if (dirtyRef.current) return;
      const nextDraft = draftFromEntry(cardType, entry);
      entryIdRef.current = entry.id;
      versionRef.current = entry.version;
      baselineRef.current = nextDraft;
      setBaseline(nextDraft);
      replaceDraft(nextDraft);
    }, [cardType, entry]);

    useEffect(() => {
      if (
        !entryIdRef.current ||
        !isDirty ||
        isSaving ||
        isDeleting ||
        error ||
        !draft.title.trim()
      ) return;
      const timeout = window.setTimeout(() => void commitDraft(), 650);
      return () => window.clearTimeout(timeout);
    }, [commitDraft, draft, error, isDeleting, isDirty, isSaving]);

    async function toggleArchived() {
      if (!entry || isSaving || isDeleting) return;
      await commitDraft(entry.archivedAt === null);
    }

    async function deleteRow() {
      if (!entry) {
        onRemoveDraft(rowKey);
        return;
      }
      if (entry.usageCount > 0 || isSaving || isDeleting) return;
      if (!(await commitDraft())) return;
      if (!window.confirm(`Delete library entry "${draftRef.current.title.trim()}"?`)) return;
      setIsDeleting(true);
      setError(null);
      try {
        await deleteV2CardLibraryEntry(
          workspaceId,
          cardType.id,
          entry.id,
          versionRef.current ?? entry.version
        );
        onEntryDeleted(rowKey);
      } catch (deleteError) {
        setError(apiErrorMessage(deleteError, "Could not delete this library row."));
      } finally {
        setIsDeleting(false);
      }
    }

    const invalidFieldKeys = new Set(
      (entry?.validationIssues ?? [])
        .map((issue) => issue.fieldKey)
        .filter((fieldKey): fieldKey is string => Boolean(fieldKey))
    );
    const rowDisabled = isDeleting;

    return (
      <tr
        className={entry?.archivedAt ? "v2CardLibraryRowArchived" : undefined}
        onBlur={(event) => {
          if (
            !entryIdRef.current &&
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            void commitDraft();
          }
        }}
      >
        <td className="v2CardLibraryNameCell">
          <input
            className="v2CardLibraryCellInput v2CardLibraryNameInput"
            value={draft.title}
            placeholder={`New ${cardType.name.toLocaleLowerCase()}`}
            aria-label="Entry name"
            disabled={rowDisabled}
            onChange={(event) => updateDraft({ title: event.target.value })}
          />
          <div className="v2CardLibraryRowMeta">
            {isSaving ? (
              <span><LoaderCircle size={11} className="v2CardLibrarySpinner" /> Saving…</span>
            ) : entry?.validationIssues.length ? (
              <span className="v2CardLibraryInvalid" title={entry.validationIssues.map((issue) => issue.message).join("\n")}>
                <AlertTriangle size={11} /> Incomplete
              </span>
            ) : entry ? (
              <span>v{entry.version}</span>
            ) : (
              <span>New row</span>
            )}
          </div>
          {error ? <p className="v2CardLibraryRowError">{error}</p> : null}
        </td>
        {cardType.schema.fields.map((field) => (
          <td key={field.key}>
            <LibraryFieldInput
              field={field}
              value={draft.fieldValues[field.key] ?? ""}
              disabled={rowDisabled}
              invalid={invalidFieldKeys.has(field.key)}
              onChange={(value) => updateField(field.key, value)}
            />
          </td>
        ))}
        <td>
          <input
            className="v2CardLibraryCellInput"
            value={draft.description}
            placeholder="Optional note"
            aria-label="Entry description"
            disabled={rowDisabled}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </td>
        <td className="v2CardLibraryUsageCell">
          {entry ? (
            <span title={`${entry.usageCount} linked card${entry.usageCount === 1 ? "" : "s"}`}>
              {entry.usageCount}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="v2CardLibraryActionsCell">
          {entry ? (
            <button
              type="button"
              aria-label={entry.archivedAt ? "Restore entry" : "Archive entry"}
              title={entry.archivedAt ? "Restore entry" : "Archive entry"}
              disabled={isSaving || isDeleting}
              onClick={() => void toggleArchived()}
            >
              {entry.archivedAt ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
          ) : null}
          <button
            type="button"
            className="v2CardLibraryDeleteButton"
            aria-label={entry ? "Delete entry" : "Remove new row"}
            title={
              entry?.usageCount
                ? "Used entries cannot be deleted. Archive the entry instead."
                : entry
                  ? "Delete entry"
                  : "Remove new row"
            }
            disabled={Boolean(entry?.usageCount) || isSaving || isDeleting}
            onClick={() => void deleteRow()}
          >
            {isDeleting ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <Trash2 size={14} />}
          </button>
        </td>
      </tr>
    );
  }
);

export function V2CardLibraryManager({
  cardTypes,
  initialCardTypeId,
  onBack,
  onClose,
}: V2CardLibraryManagerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [cardTypeOverrides, setCardTypeOverrides] = useState<Record<string, V2CardType>>({});
  const effectiveCardTypes = useMemo(
    () => cardTypes.map((cardType) => cardTypeOverrides[cardType.id] ?? cardType),
    [cardTypeOverrides, cardTypes]
  );
  const sortedCardTypes = useMemo(
    () => [...effectiveCardTypes].sort((left, right) => left.name.localeCompare(right.name)),
    [effectiveCardTypes]
  );
  const [selectedCardTypeId, setSelectedCardTypeId] = useState(
    sortedCardTypes.some((cardType) => cardType.id === initialCardTypeId)
      ? initialCardTypeId
      : sortedCardTypes[0]?.id ?? ""
  );
  const selectedCardType =
    sortedCardTypes.find((cardType) => cardType.id === selectedCardTypeId) ?? null;
  const [entries, setEntries] = useState<V2CardLibraryEntry[]>([]);
  const [pendingRowIds, setPendingRowIds] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("active");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [xlsxRoundTripOpen, setXlsxRoundTripOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const rowHandlesRef = useRef(new Map<string, V2CardLibraryRowHandle>());

  const flushRows = useCallback(async (blurActiveEditor = false): Promise<boolean> => {
    if (
      blurActiveEditor &&
      document.activeElement instanceof HTMLElement &&
      dialogRef.current?.contains(document.activeElement)
    ) {
      document.activeElement.blur();
      await Promise.resolve();
    }
    const results = await Promise.all(
      [...rowHandlesRef.current.values()].map((handle) => handle.flush())
    );
    return results.every(Boolean);
  }, []);

  const closeManager = useCallback(async () => {
    if (isTransitioning || isSavingAll) return;
    setIsTransitioning(true);
    const flushed = await flushRows(true);
    setIsTransitioning(false);
    if (flushed) onClose();
  }, [flushRows, isSavingAll, isTransitioning, onClose]);

  useDialogFocus(dialogRef, () => { void closeManager(); }, !importOpen && !xlsxRoundTripOpen);

  useEffect(() => {
    if (!selectedCardType) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    setEntries([]);
    setPendingRowIds([]);
    setNextCursor(null);
    void listV2CardLibraryEntries(
      selectedCardType.workspaceId,
      selectedCardType.id,
      { query: searchQuery || undefined, status: statusFilter, limit: 100, sort: "title" },
      { signal: controller.signal }
    )
      .then((page) => {
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(apiErrorMessage(error, "Could not load this card library."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [reloadNonce, searchQuery, selectedCardType, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        if (await flushRows()) setSearchQuery(searchInput.trim());
      })();
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [flushRows, searchInput]);

  async function selectCardType(cardTypeId: string) {
    if (cardTypeId === selectedCardTypeId || isTransitioning || isSavingAll) return;
    setIsTransitioning(true);
    const flushed = await flushRows(true);
    if (flushed) setSelectedCardTypeId(cardTypeId);
    setIsTransitioning(false);
  }

  async function changeStatusFilter(nextStatus: LibraryStatusFilter) {
    if (nextStatus === statusFilter || isTransitioning || isSavingAll) return;
    setIsTransitioning(true);
    const flushed = await flushRows(true);
    if (flushed) setStatusFilter(nextStatus);
    setIsTransitioning(false);
  }

  async function goBack() {
    if (!selectedCardType || isTransitioning || isSavingAll) return;
    setIsTransitioning(true);
    const flushed = await flushRows(true);
    setIsTransitioning(false);
    if (flushed) onBack(selectedCardType.id);
  }

  async function saveRows() {
    if (isTransitioning || isSavingAll) return;
    setIsSavingAll(true);
    await flushRows(true);
    setIsSavingAll(false);
  }

  async function openCsvImport() {
    if (!selectedCardType || isTransitioning || isSavingAll) return;
    setIsTransitioning(true);
    const flushed = await flushRows(true);
    setIsTransitioning(false);
    if (!flushed) return;
    setImportMessage(null);
    setImportOpen(true);
  }

  async function openXlsxRoundTrip() {
    if (!selectedCardType || isTransitioning || isSavingAll) return;
    setIsTransitioning(true);
    const flushed = await flushRows(true);
    setIsTransitioning(false);
    if (!flushed) return;
    setImportMessage(null);
    setXlsxRoundTripOpen(true);
  }

  function addRow() {
    setPendingRowIds((current) => [createLocalRowId(), ...current]);
  }

  function handleEntrySaved(rowKey: string, savedEntry: V2CardLibraryEntry) {
    setPendingRowIds((current) => current.filter((id) => id !== rowKey));
    setEntries((current) => {
      const withoutSaved = current.filter((entry) => entry.id !== savedEntry.id);
      return entryMatchesFilter(savedEntry, statusFilter, searchQuery)
        ? [savedEntry, ...withoutSaved]
        : withoutSaved;
    });
  }

  function handleEntryDeleted(rowKey: string) {
    setEntries((current) => current.filter((entry) => entry.id !== rowKey));
    setPendingRowIds((current) => current.filter((id) => id !== rowKey));
  }

  async function loadMore() {
    if (!selectedCardType || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const page = await listV2CardLibraryEntries(selectedCardType.workspaceId, selectedCardType.id, {
        query: searchQuery || undefined,
        status: statusFilter,
        cursor: nextCursor,
        limit: 100,
        sort: "title",
      });
      setEntries((current) => {
        const byId = new Map(current.map((entry) => [entry.id, entry]));
        for (const entry of page.entries) byId.set(entry.id, entry);
        return [...byId.values()];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(apiErrorMessage(error, "Could not load more library entries."));
    } finally {
      setIsLoadingMore(false);
    }
  }

  const sortedEntries = useMemo(
    () => [...entries].sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)),
    [entries]
  );
  const tableMinimumWidth = 620 + (selectedCardType?.schema.fields.length ?? 0) * 180;

  return (
    <>
      <div
        ref={dialogRef}
        className="v2ModalOverlay"
        role="dialog"
        aria-modal="true"
        aria-label="Card libraries"
        aria-hidden={importOpen || xlsxRoundTripOpen || undefined}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) void closeManager();
        }}
      >
      <section className="v2CardLibraryManager" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CardTypeManagerHeader v2CardLibraryHeader">
          <div className="v2CardLibraryHeading">
            <button
              type="button"
              aria-label="Back to card types"
              title="Back to card types"
              disabled={isTransitioning || isSavingAll}
              onClick={() => void goBack()}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2>{selectedCardType ? `${selectedCardType.name} library` : "Card libraries"}</h2>
              <p>Each row is a reusable card record. Changes save automatically.</p>
            </div>
          </div>
          <button
            type="button"
            className="v2InspectorCloseButton"
            aria-label="Close library"
            disabled={isTransitioning || isSavingAll}
            onClick={() => void closeManager()}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="v2CardLibraryBody">
          <aside className="v2CardTypeManagerList" aria-label="Card type libraries">
            {sortedCardTypes.map((cardType) => {
              const Icon = getV2CardTypeIcon(cardType);
              const accentKey = resolveCardTypeAccentKey(cardType);
              return (
                <button
                  key={cardType.id}
                  type="button"
                  className={`v2CardTypeManagerRow${cardType.id === selectedCardTypeId ? " v2CardTypeManagerRowActive" : ""}`}
                  style={{
                    ["--v2-manager-row-accent" as string]: `var(--yd-accent-${accentKey}-solid)`,
                    ["--v2-manager-row-accent-soft" as string]: `var(--yd-accent-${accentKey}-soft)`,
                  }}
                  disabled={isTransitioning || isSavingAll}
                  onClick={() => void selectCardType(cardType.id)}
                >
                  <span className="v2CardTypeManagerRowIcon" aria-hidden="true"><Icon size={15} /></span>
                  <span className="v2CardTypeManagerRowText"><strong>{cardType.name}</strong><span>Library</span></span>
                </button>
              );
            })}
          </aside>

          <main className="v2CardLibraryMain">
            <div className="v2CardLibraryToolbar">
              <label className="v2CardLibrarySearch">
                <Search size={14} aria-hidden="true" />
                <input
                  value={searchInput}
                  placeholder="Search this library"
                  aria-label="Search this library"
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </label>
              <select
                value={statusFilter}
                aria-label="Library status"
                disabled={isTransitioning || isSavingAll}
                onChange={(event) => void changeStatusFilter(event.target.value as LibraryStatusFilter)}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
              <div className="v2CardLibraryToolbarActions">
                <button
                  type="button"
                  className="v2SchemaEditButton"
                  disabled={!selectedCardType || isLoading || isTransitioning || isSavingAll}
                  onClick={() => void openXlsxRoundTrip()}
                >
                  <FileSpreadsheet size={14} />
                  <span>Edit in Excel</span>
                </button>
                <button
                  type="button"
                  className="v2SchemaEditButton"
                  disabled={!selectedCardType || isLoading || isTransitioning || isSavingAll}
                  onClick={() => void openCsvImport()}
                >
                  <FileUp size={14} />
                  <span>Import CSV</span>
                </button>
                <button
                  type="button"
                  className="v2SchemaEditButton"
                  disabled={!selectedCardType || isLoading || isTransitioning || isSavingAll}
                  onClick={addRow}
                >
                  <Plus size={14} />
                  <span>New row</span>
                </button>
                <button
                  type="button"
                  className="v2InspectorPrimaryAction"
                  disabled={!selectedCardType || isLoading || isTransitioning || isSavingAll}
                  onClick={() => void saveRows()}
                >
                  {isSavingAll ? <LoaderCircle size={14} className="v2CardLibrarySpinner" /> : <Save size={14} />}
                  <span>{isSavingAll ? "Saving…" : "Save changes"}</span>
                </button>
              </div>
            </div>

            {loadError ? <p className="v2CardLibraryLoadError">{loadError}</p> : null}
            {importMessage ? <p className="v2CardLibraryImportMessage" role="status">{importMessage}</p> : null}
            <div className="v2CardLibraryTableWrap">
              {selectedCardType ? (
                <table className="v2CardLibraryTable" style={{ minWidth: tableMinimumWidth }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      {selectedCardType.schema.fields.map((field) => <th key={field.key}>{field.label}{field.required ? " *" : ""}</th>)}
                      <th>Description</th>
                      <th className="v2CardLibraryUsageCell">Used</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRowIds.map((rowId) => (
                      <V2CardLibraryRow
                        key={rowId}
                        ref={(handle) => {
                          if (handle) rowHandlesRef.current.set(rowId, handle);
                          else rowHandlesRef.current.delete(rowId);
                        }}
                        rowKey={rowId}
                        workspaceId={selectedCardType.workspaceId}
                        cardType={selectedCardType}
                        entry={null}
                        onEntrySaved={handleEntrySaved}
                        onEntryDeleted={handleEntryDeleted}
                        onRemoveDraft={(id) => setPendingRowIds((current) => current.filter((rowId) => rowId !== id))}
                      />
                    ))}
                    {sortedEntries.map((entry) => (
                      <V2CardLibraryRow
                        key={entry.id}
                        ref={(handle) => {
                          if (handle) rowHandlesRef.current.set(entry.id, handle);
                          else rowHandlesRef.current.delete(entry.id);
                        }}
                        rowKey={entry.id}
                        workspaceId={selectedCardType.workspaceId}
                        cardType={selectedCardType}
                        entry={entry}
                        onEntrySaved={handleEntrySaved}
                        onEntryDeleted={handleEntryDeleted}
                        onRemoveDraft={() => undefined}
                      />
                    ))}
                  </tbody>
                </table>
              ) : null}
              {isLoading ? (
                <div className="v2CardLibraryEmpty"><LoaderCircle size={18} className="v2CardLibrarySpinner" /><span>Loading library…</span></div>
              ) : pendingRowIds.length === 0 && sortedEntries.length === 0 ? (
                <div className="v2CardLibraryEmpty"><span>No rows in this view.</span><small>Add the first reusable {selectedCardType?.name.toLocaleLowerCase() ?? "card"}.</small></div>
              ) : null}
            </div>
            {nextCursor ? (
              <button type="button" className="v2CardLibraryLoadMore" disabled={isLoadingMore} onClick={() => void loadMore()}>
                {isLoadingMore ? "Loading…" : "Load more"}
              </button>
            ) : null}
          </main>
        </div>
      </section>
      </div>
      {importOpen && selectedCardType ? (
        <V2CsvLibraryImportDialog
          cardType={selectedCardType}
          onClose={() => setImportOpen(false)}
          onImported={(result) => {
            setImportOpen(false);
            setReloadNonce((current) => current + 1);
            setImportMessage(
              `Import complete: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`
            );
          }}
        />
      ) : null}
      {xlsxRoundTripOpen && selectedCardType ? (
        <V2XlsxLibraryRoundTripDialog
          cardType={selectedCardType}
          onClose={() => setXlsxRoundTripOpen(false)}
          onImported={(result) => {
            setCardTypeOverrides((current) => ({ ...current, [result.cardType.id]: result.cardType }));
            setReloadNonce((current) => current + 1);
            setImportMessage(
              `Workbook applied: ${result.createdCount} created, ${result.updatedCount} updated, ${result.addedFieldCount} fields added.`
            );
          }}
        />
      ) : null}
    </>
  );
}
