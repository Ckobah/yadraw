"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Spline,
  X,
} from "lucide-react";
import type {
  V2ConnectionMarker,
  V2ConnectionType,
  V2ConnectionTypeSchema,
  V2ConnectionVisualStyle,
  V2CreateConnectionTypeRequest,
  V2UpdateConnectionTypeRequest,
} from "@yadraw/shared";
import {
  buildV2CardTypeSchemaFromDrafts,
  createV2CardTypeSchemaFieldDrafts,
  V2CardTypeSchemaEditor,
  type V2CardTypeSchemaFieldDraft,
} from "./v2-card-type-schema-editor";
import { V2ConnectorStylePreview } from "./v2-connector-style-preview";
import { useDialogFocus } from "./use-dialog-focus";

type ConnectionTypeManagerMode = "existing" | "new";

type ConnectionTypeDraft = {
  id: string | null;
  key: string;
  name: string;
  fields: V2CardTypeSchemaFieldDraft[];
  defaultVisualStyle: V2ConnectionVisualStyle;
};

type Props = {
  connectionTypes: V2ConnectionType[];
  initialConnectionTypeId?: string | null;
  onCreateConnectionType: (input: V2CreateConnectionTypeRequest) => Promise<V2ConnectionType>;
  onUpdateConnectionType: (
    connectionTypeId: string,
    input: V2UpdateConnectionTypeRequest
  ) => Promise<V2ConnectionType>;
  onClose: () => void;
};

const MARKER_OPTIONS: Array<{ value: V2ConnectionMarker; label: string }> = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "reverseArrow", label: "Reverse arrow" },
  { value: "triangle", label: "Triangle" },
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
];

const DEFAULT_STYLE: V2ConnectionVisualStyle = {
  strokeColor: "#475467",
  strokeWidth: 2,
  cornerRadius: 12,
  markerStart: "none",
  markerEnd: "arrow",
  showLabel: true,
};

function normalizeStyle(style: V2ConnectionVisualStyle | undefined): V2ConnectionVisualStyle {
  return { ...DEFAULT_STYLE, ...style };
}

function keyFromName(name: string): string {
  const transliterated = name.toLowerCase().replace(/[а-яё]/g, (letter) => ({
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }[letter] ?? ""));
  const normalized = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "connector_type";
  return (/^[a-z]/.test(normalized) ? normalized : `connector_${normalized}`).replace(/_+/g, "_");
}

function uniqueKey(name: string, connectionTypes: V2ConnectionType[]): string {
  const base = keyFromName(name);
  const used = new Set(connectionTypes.map((type) => type.key));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function schemaDrafts(schema: V2ConnectionTypeSchema | null | undefined): V2CardTypeSchemaFieldDraft[] {
  return createV2CardTypeSchemaFieldDrafts(schema as Parameters<typeof createV2CardTypeSchemaFieldDrafts>[0]);
}

function buildSchema(fields: V2CardTypeSchemaFieldDraft[]) {
  const result = buildV2CardTypeSchemaFromDrafts(fields);
  if (!result.ok) return result;
  return { ok: true as const, schema: result.schema as V2ConnectionTypeSchema };
}

function fromType(connectionType: V2ConnectionType): ConnectionTypeDraft {
  return {
    id: connectionType.id,
    key: connectionType.key,
    name: connectionType.name,
    fields: schemaDrafts(connectionType.schema),
    defaultVisualStyle: normalizeStyle(connectionType.defaultVisualStyle),
  };
}

function emptyDraft(): ConnectionTypeDraft {
  return { id: null, key: "", name: "", fields: [], defaultVisualStyle: { ...DEFAULT_STYLE } };
}

export function V2ConnectionTypeManager({
  connectionTypes,
  initialConnectionTypeId,
  onCreateConnectionType,
  onUpdateConnectionType,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, () => { void closeManager(); });
  const sortedTypes = useMemo(
    () => [...connectionTypes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [connectionTypes]
  );
  const initialType = sortedTypes.find((type) => type.id === initialConnectionTypeId) ?? sortedTypes[0] ?? null;
  const [mode, setMode] = useState<ConnectionTypeManagerMode>(initialType ? "existing" : "new");
  const [selectedId, setSelectedId] = useState<string | null>(initialType?.id ?? null);
  const [draft, setDraft] = useState<ConnectionTypeDraft>(() => initialType ? fromType(initialType) : emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedType = connectionTypes.find((type) => type.id === selectedId) ?? null;
  const hasChanges = mode === "existing" && selectedType
    ? JSON.stringify(draft) !== JSON.stringify(fromType(selectedType))
    : false;

  useEffect(() => {
    if (mode !== "existing" || !selectedId || hasChanges || isSaving) return;
    const selected = connectionTypes.find((type) => type.id === selectedId);
    if (selected) setDraft(fromType(selected));
  }, [connectionTypes, hasChanges, isSaving, mode, selectedId]);

  useEffect(() => {
    if (!hasChanges || isSaving) return;
    const timeout = window.setTimeout(() => void saveDraft(), 700);
    return () => window.clearTimeout(timeout);
  }, [draft, hasChanges, isSaving]);

  function updateDraft(patch: Partial<Omit<ConnectionTypeDraft, "id">>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function updateStyle(patch: V2ConnectionVisualStyle) {
    updateDraft({ defaultVisualStyle: { ...draft.defaultVisualStyle, ...patch } });
  }

  async function saveDraft(): Promise<boolean> {
    const name = draft.name.trim();
    if (!name) {
      setError("Name is required.");
      return false;
    }
    const schemaResult = buildSchema(draft.fields);
    if (!schemaResult.ok) {
      setError(schemaResult.error);
      return false;
    }
    const key = mode === "new" ? uniqueKey(name, connectionTypes) : draft.key;
    setIsSaving(true);
    setError(null);
    try {
      if (mode === "new") {
        const created = await onCreateConnectionType({
          key,
          name,
          description: null,
          schema: schemaResult.schema,
          defaultVisualStyle: draft.defaultVisualStyle,
        });
        setMode("existing");
        setSelectedId(created.id);
        setDraft(fromType(created));
      } else if (draft.id) {
        await onUpdateConnectionType(draft.id, {
          name,
          schema: schemaResult.schema,
          defaultVisualStyle: draft.defaultVisualStyle,
        });
      }
      return true;
    } catch {
      setError("Could not save connector type.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function selectType(connectionType: V2ConnectionType) {
    if (isSaving || (hasChanges && !(await saveDraft()))) return;
    setMode("existing");
    setSelectedId(connectionType.id);
    setDraft(fromType(connectionType));
    setError(null);
  }

  async function selectNew() {
    if (isSaving || (hasChanges && !(await saveDraft()))) return;
    setMode("new");
    setSelectedId(null);
    setDraft(emptyDraft());
    setError(null);
  }

  async function closeManager() {
    if (hasChanges && !(await saveDraft())) return;
    onClose();
  }

  const showLabel = draft.defaultVisualStyle.showLabel !== false;

  return (
    <div
      ref={dialogRef}
      className="v2ModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Connector Type Manager"
      onPointerDown={(event) => { if (event.target === event.currentTarget) void closeManager(); }}
    >
      <section className="v2CardTypeManager" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CardTypeManagerHeader">
          <h2>Connector Type Manager</h2>
          <button type="button" className="v2InspectorCloseButton" aria-label="Close manager" onClick={() => void closeManager()}>
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="v2CardTypeManagerBody">
          <aside className="v2CardTypeManagerList" aria-label="Connector types">
            <button
              type="button"
              className={`v2CardTypeManagerNewButton${mode === "new" ? " v2CardTypeManagerRowActive" : ""}`}
              onClick={() => void selectNew()}
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>New type</span>
            </button>
            {sortedTypes.map((connectionType) => (
              <button
                key={connectionType.id}
                type="button"
                className={`v2CardTypeManagerRow v2ConnectionTypeManagerRow${selectedId === connectionType.id && mode === "existing" ? " v2CardTypeManagerRowActive" : ""}`}
                onClick={() => void selectType(connectionType)}
              >
                <V2ConnectorStylePreview style={connectionType.defaultVisualStyle} label={connectionType.name} />
                <span className="v2CardTypeManagerRowText"><strong>{connectionType.name}</strong></span>
              </button>
            ))}
          </aside>

          <div className="v2CardTypeManagerEditor">
            <section className="v2ConnectionTypePreviewPanel">
              <V2ConnectorStylePreview style={draft.defaultVisualStyle} label={draft.name || "Connector"} />
              {showLabel ? <span>{draft.name || "Connector"}</span> : null}
            </section>

            <section className="v2CardTypeManagerSection">
              <input
                className="v2InspectorDataValue"
                value={draft.name}
                placeholder="Type name"
                aria-label="Type name"
                onChange={(event) => updateDraft({ name: event.target.value })}
              />
            </section>

            <V2CardTypeSchemaEditor fields={draft.fields} onChange={(fields) => updateDraft({ fields })} />

            <section className="v2CardTypeManagerSection v2ConnectionTypeVisualControls" aria-label="Connector appearance">
              <label className="v2ConnectionTypeColor" title="Color">
                <input
                  type="color"
                  value={draft.defaultVisualStyle.strokeColor ?? DEFAULT_STYLE.strokeColor}
                  aria-label="Color"
                  onChange={(event) => updateStyle({ strokeColor: event.target.value })}
                />
              </label>
              <label title="Width">
                <Minus size={15} aria-hidden="true" />
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={0.5}
                  value={draft.defaultVisualStyle.strokeWidth ?? DEFAULT_STYLE.strokeWidth}
                  aria-label="Width"
                  onChange={(event) => updateStyle({ strokeWidth: Number(event.target.value) })}
                />
                <output>{draft.defaultVisualStyle.strokeWidth}</output>
              </label>
              <label title="Corner radius">
                <Spline size={15} aria-hidden="true" />
                <input
                  type="range"
                  min={0}
                  max={48}
                  step={2}
                  value={draft.defaultVisualStyle.cornerRadius ?? DEFAULT_STYLE.cornerRadius}
                  aria-label="Corner radius"
                  onChange={(event) => updateStyle({ cornerRadius: Number(event.target.value) })}
                />
                <output>{draft.defaultVisualStyle.cornerRadius}</output>
              </label>
              <label title="Start marker">
                <ArrowLeftToLine size={15} aria-hidden="true" />
                <select
                  value={draft.defaultVisualStyle.markerStart ?? "none"}
                  aria-label="Start marker"
                  onChange={(event) => updateStyle({ markerStart: event.target.value as V2ConnectionMarker })}
                >
                  {MARKER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label title="End marker">
                <ArrowRightToLine size={15} aria-hidden="true" />
                <select
                  value={draft.defaultVisualStyle.markerEnd ?? "arrow"}
                  aria-label="End marker"
                  onChange={(event) => updateStyle({ markerEnd: event.target.value as V2ConnectionMarker })}
                >
                  {MARKER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <button
                type="button"
                className={showLabel ? "v2ConnectionTypeLabelToggle v2ConnectionTypeLabelToggleActive" : "v2ConnectionTypeLabelToggle"}
                title={showLabel ? "Hide connector names" : "Show connector names"}
                aria-label={showLabel ? "Hide connector names" : "Show connector names"}
                aria-pressed={showLabel}
                onClick={() => updateStyle({ showLabel: !showLabel })}
              >
                {showLabel ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
              </button>
            </section>

            {error ? <p className="v2InspectorDataError">{error}</p> : null}
            {mode === "new" ? (
              <div className="v2InspectorEditActions v2CardTypeManagerActions">
                <span />
                <button type="button" className="v2InspectorPrimaryAction" disabled={isSaving} onClick={() => void saveDraft()}>
                  <Plus size={13} strokeWidth={2.2} />
                  <span>{isSaving ? "Creating..." : "Create connector type"}</span>
                </button>
              </div>
            ) : error ? <p className="v2ConnectionTypeAutosaveError">Auto-save failed</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
