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
  V2ConnectionTypeSemantics,
  V2ConnectionVisualStyle,
  V2CreateConnectionTypeRequest,
  V2UpdateConnectionTypeRequest,
} from "@yadraw/shared";
import { v2ConnectionTypeDefinitionSchema } from "@yadraw/shared";
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
  semantics?: V2ConnectionTypeSemantics;
  defaultVisualStyle: V2ConnectionVisualStyle;
};

export type V2NewConnectionTypeSeed = {
  schema?: V2ConnectionTypeSchema | null;
  defaultVisualStyle: V2ConnectionVisualStyle;
};

type Props = {
  connectionTypes: V2ConnectionType[];
  initialConnectionTypeId?: string | null;
  initialNewTypeSeed?: V2NewConnectionTypeSeed | null;
  onCreateConnectionType: (input: V2CreateConnectionTypeRequest) => Promise<V2ConnectionType>;
  onUpdateConnectionType: (
    connectionTypeId: string,
    input: V2UpdateConnectionTypeRequest
  ) => Promise<V2ConnectionType>;
  onClose: () => void;
};

const MARKER_OPTIONS: Array<{ value: V2ConnectionMarker; label: string }> = [
  { value: "none", label: "Line" },
  { value: "arrow", label: "Arrow" },
  { value: "reverseArrow", label: "Reverse arrow" },
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "ring", label: "Ring" },
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
  return createV2CardTypeSchemaFieldDrafts(schema);
}

function buildSchema(
  fields: V2CardTypeSchemaFieldDraft[],
  semantics: V2ConnectionTypeSemantics | undefined
) {
  const result = buildV2CardTypeSchemaFromDrafts(fields);
  if (!result.ok) return result;
  const parsed = v2ConnectionTypeDefinitionSchema.safeParse({
    fields: result.schema.fields.map((field, index) => ({
      ...field,
      ...(field.type === "number" && fields[index]?.numberConstraints
        ? { numberConstraints: fields[index].numberConstraints }
        : {})
    })),
    ...(semantics ? { semantics } : {})
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid connector semantics."
    };
  }
  return { ok: true as const, schema: parsed.data as V2ConnectionTypeSchema };
}

function fromType(connectionType: V2ConnectionType): ConnectionTypeDraft {
  return {
    id: connectionType.id,
    key: connectionType.key,
    name: connectionType.name,
    fields: schemaDrafts(connectionType.schema),
    semantics: connectionType.schema.semantics,
    defaultVisualStyle: normalizeStyle(connectionType.defaultVisualStyle),
  };
}

function emptyDraft(seed?: V2NewConnectionTypeSeed | null): ConnectionTypeDraft {
  return {
    id: null,
    key: "",
    name: "",
    fields: schemaDrafts(seed?.schema),
    semantics: seed?.schema?.semantics,
    defaultVisualStyle: normalizeStyle(seed?.defaultVisualStyle),
  };
}

export function V2ConnectionTypeManager({
  connectionTypes,
  initialConnectionTypeId,
  initialNewTypeSeed,
  onCreateConnectionType,
  onUpdateConnectionType,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useDialogFocus(dialogRef, () => { void closeManager(); });
  const sortedTypes = useMemo(
    () => [...connectionTypes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [connectionTypes]
  );
  const initialType = initialNewTypeSeed
    ? null
    : sortedTypes.find((type) => type.id === initialConnectionTypeId) ?? sortedTypes[0] ?? null;
  const [mode, setMode] = useState<ConnectionTypeManagerMode>(
    initialNewTypeSeed ? "new" : initialType ? "existing" : "new"
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialType?.id ?? null);
  const [draft, setDraft] = useState<ConnectionTypeDraft>(() =>
    initialType ? fromType(initialType) : emptyDraft(initialNewTypeSeed)
  );
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

  useEffect(() => {
    if (mode === "new") nameInputRef.current?.focus();
  }, [mode]);

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
    const schemaResult = buildSchema(draft.fields, draft.semantics);
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
  const quantitySemantics = draft.semantics?.quantity;
  const numberFields = draft.fields.filter((field) => field.type === "number");
  const unitFields = draft.fields.filter(
    (field) => field.type === "text" || field.type === "select"
  );

  function setQuantitative(enabled: boolean) {
    if (!enabled) {
      updateDraft({ semantics: undefined });
      return;
    }

    const fields = [...draft.fields];
    if (!fields.some((field) => field.key === "quantity")) {
      fields.push({
        id: "schema-quantity",
        key: "quantity",
        label: "Quantity",
        type: "number",
        required: true,
        placeholder: "",
        description: "Quantity contributed by this relationship.",
        optionsText: "",
        defaultValue: 1,
        numberConstraints: { min: 0 }
      });
    }
    if (!fields.some((field) => field.key === "unit")) {
      fields.push({
        id: "schema-unit",
        key: "unit",
        label: "Unit",
        type: "select",
        required: true,
        placeholder: "",
        description: "Stable unit code used for aggregation.",
        optionsText: "piece:Pieces\nkg:Kilograms\nm:Meters",
        defaultValue: "piece"
      });
    }
    updateDraft({
      fields,
      semantics: {
        version: 1,
        sourceRole: "component",
        targetRole: "assembly",
        quantity: {
          valueField: "quantity",
          unitField: "unit",
          basis: "per_target",
          targetMultiplierField: "plannedQuantity",
          aggregation: "sum"
        }
      }
    });
  }

  function updateSemantics(patch: Partial<V2ConnectionTypeSemantics>) {
    if (!draft.semantics) return;
    updateDraft({ semantics: { ...draft.semantics, ...patch } });
  }

  function updateQuantity(
    patch: Partial<NonNullable<V2ConnectionTypeSemantics["quantity"]>>
  ) {
    if (!draft.semantics?.quantity) return;
    updateSemantics({ quantity: { ...draft.semantics.quantity, ...patch } });
  }

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
                ref={nameInputRef}
                className="v2InspectorDataValue"
                value={draft.name}
                placeholder="Type name"
                aria-label="Type name"
                onChange={(event) => updateDraft({ name: event.target.value })}
              />
            </section>

            <V2CardTypeSchemaEditor fields={draft.fields} onChange={(fields) => updateDraft({ fields })} />

            <section className="v2CardTypeManagerSection v2ConnectionTypeSemantics" aria-label="Relationship meaning">
              <label className="v2ConnectionTypeSemanticToggle">
                <input
                  type="checkbox"
                  checked={Boolean(quantitySemantics)}
                  onChange={(event) => setQuantitative(event.target.checked)}
                />
                <span>
                  <strong>Quantitative relationship</strong>
                  <small>Use this connector in totals and assembly calculations.</small>
                </span>
              </label>

              {draft.semantics && quantitySemantics ? (
                <div className="v2ConnectionTypeSemanticGrid">
                  <label>
                    <span>Source role</span>
                    <input
                      className="v2InspectorDataValue"
                      value={draft.semantics.sourceRole}
                      placeholder="component"
                      onChange={(event) => updateSemantics({ sourceRole: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Target role</span>
                    <input
                      className="v2InspectorDataValue"
                      value={draft.semantics.targetRole}
                      placeholder="assembly"
                      onChange={(event) => updateSemantics({ targetRole: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Quantity field</span>
                    <select
                      className="v2InspectorDataValue"
                      value={quantitySemantics.valueField}
                      onChange={(event) => updateQuantity({ valueField: event.target.value })}
                    >
                      {numberFields.map((field) => (
                        <option key={field.id} value={field.key}>{field.label || field.key}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Unit field</span>
                    <select
                      className="v2InspectorDataValue"
                      value={quantitySemantics.unitField ?? ""}
                      onChange={(event) => updateQuantity({
                        unitField: event.target.value,
                        fixedUnitCode: undefined
                      })}
                    >
                      {unitFields.map((field) => (
                        <option key={field.id} value={field.key}>{field.label || field.key}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Quantity basis</span>
                    <select
                      className="v2InspectorDataValue"
                      value={quantitySemantics.basis}
                      onChange={(event) => {
                        const basis = event.target.value as "absolute" | "per_target";
                        updateQuantity({
                          basis,
                          targetMultiplierField: basis === "absolute"
                            ? undefined
                            : quantitySemantics.targetMultiplierField ?? "plannedQuantity"
                        });
                      }}
                    >
                      <option value="absolute">Absolute quantity</option>
                      <option value="per_target">Per target item</option>
                    </select>
                  </label>
                  {quantitySemantics.basis === "per_target" ? (
                    <label>
                      <span>Target multiplier field</span>
                      <input
                        className="v2InspectorDataValue"
                        value={quantitySemantics.targetMultiplierField ?? ""}
                        placeholder="plannedQuantity"
                        onChange={(event) => updateQuantity({
                          targetMultiplierField: event.target.value || undefined
                        })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </section>

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
