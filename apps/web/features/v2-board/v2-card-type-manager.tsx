"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type {
  V2CardType,
  V2CreateCardTypeRequest,
  V2UpdateCardTypeRequest,
} from "@yadraw/shared";
import {
  buildV2CardTypeSchemaFromDrafts,
  createV2CardTypeSchemaFieldDrafts,
  V2CardTypeSchemaEditor,
  type V2CardTypeSchemaFieldDraft,
} from "./v2-card-type-schema-editor";
import { useDialogFocus } from "./use-dialog-focus";
import { getV2CardTypeIcon, V2_CARD_TYPE_ICON_OPTIONS } from "./v2-card-type-icons";
import { V2CardTypePreview } from "./v2-card-type-preview";
import { resolveCardTypeAccentKey } from "./v2-theme-tokens";

type CardTypeManagerMode = "existing" | "new";

type CardTypeDraft = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  fields: V2CardTypeSchemaFieldDraft[];
  defaultWidth: string;
  defaultHeight: string;
  accentKey: string;
  iconKey: string;
  hasInputPort: boolean;
  hasOutputPort: boolean;
};

type V2CardTypeManagerProps = {
  cardTypes: V2CardType[];
  initialCardTypeId?: string | null;
  onCreateCardType: (input: V2CreateCardTypeRequest) => Promise<V2CardType>;
  onUpdateCardType: (
    cardTypeId: string,
    input: V2UpdateCardTypeRequest
  ) => Promise<V2CardType>;
  onDeleteCardType: (cardTypeId: string) => Promise<void>;
  onClose: () => void;
};

const CARD_TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const CARD_TYPE_DEFAULT_SIZE = { width: 172, height: 122 } as const;
const ACCENT_OPTIONS = [
  { key: "blue", label: "Blue" },
  { key: "green", label: "Green" },
  { key: "orange", label: "Orange" },
  { key: "red", label: "Red" },
  { key: "purple", label: "Purple" },
  { key: "gray", label: "Gray" },
] as const;

function normalizeDraftAccentKey(accentKey: string): string {
  return ACCENT_OPTIONS.some((option) => option.key === accentKey) ? accentKey : "blue";
}

function normalizeDraftIconKey(iconKey: string | null | undefined): string {
  const normalized = iconKey?.trim();
  if (normalized && V2_CARD_TYPE_ICON_OPTIONS.some((option) => option.key === normalized)) {
    return normalized;
  }
  if (normalized === "source") return "database";
  if (normalized === "settings") return "gear";
  return "box";
}

function draftFromCardType(cardType: V2CardType): CardTypeDraft {
  return {
    id: cardType.id,
    key: cardType.key,
    name: cardType.name,
    description: cardType.description,
    fields: createV2CardTypeSchemaFieldDrafts(cardType.schema),
    defaultWidth: String(cardType.defaultSize.width),
    defaultHeight: String(cardType.defaultSize.height),
    accentKey: normalizeDraftAccentKey(resolveCardTypeAccentKey(cardType)),
    iconKey: normalizeDraftIconKey(cardType.defaultVisualStyle.iconKey ?? cardType.key),
    hasInputPort: cardType.ports.some((port) => port.direction === "input" && port.key === "input"),
    hasOutputPort: cardType.ports.some((port) => port.direction === "output" && port.key === "output"),
  };
}

function emptyDraft(): CardTypeDraft {
  return {
    id: null,
    key: "",
    name: "",
    description: "",
    fields: [],
    defaultWidth: String(CARD_TYPE_DEFAULT_SIZE.width),
    defaultHeight: String(CARD_TYPE_DEFAULT_SIZE.height),
    accentKey: "blue",
    iconKey: "box",
    hasInputPort: true,
    hasOutputPort: true,
  };
}

function buildDefaultVisualStyle(draft: CardTypeDraft): V2CreateCardTypeRequest["defaultVisualStyle"] {
  return {
    accentKey: draft.accentKey.trim(),
    iconKey: draft.iconKey.trim(),
  };
}

function buildDefaultPorts(draft: CardTypeDraft): V2CreateCardTypeRequest["ports"] {
  const ports: NonNullable<V2CreateCardTypeRequest["ports"]> = [];
  if (draft.hasInputPort) {
    ports.push({
      key: "input",
      label: "Input",
      direction: "input",
      dataType: "json",
      required: false,
      sortOrder: 0,
    });
  }
  if (draft.hasOutputPort) {
    ports.push({
      key: "output",
      label: "Output",
      direction: "output",
      dataType: "json",
      required: false,
      sortOrder: 1,
    });
  }
  return ports;
}

export function V2CardTypeManager({
  cardTypes,
  initialCardTypeId,
  onCreateCardType,
  onUpdateCardType,
  onDeleteCardType,
  onClose,
}: V2CardTypeManagerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, () => { void closeManager(); });
  const sortedCardTypes = useMemo(
    () => [...cardTypes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [cardTypes]
  );
  const initialType =
    sortedCardTypes.find((cardType) => cardType.id === initialCardTypeId) ??
    sortedCardTypes[0] ??
    null;
  const [mode, setMode] = useState<CardTypeManagerMode>(initialType ? "existing" : "new");
  const [selectedCardTypeId, setSelectedCardTypeId] = useState<string | null>(initialType?.id ?? null);
  const [draft, setDraft] = useState<CardTypeDraft>(() =>
    initialType ? draftFromCardType(initialType) : emptyDraft()
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedCardType = cardTypes.find((cardType) => cardType.id === selectedCardTypeId) ?? null;
  const hasDraftChanges =
    mode === "existing" && selectedCardType
      ? JSON.stringify(draft) !== JSON.stringify(draftFromCardType(selectedCardType))
      : false;

  function actionErrorMessage(actionError: unknown, fallback: string): string {
    if (typeof actionError !== "object" || actionError === null) return fallback;
    const body = "body" in actionError ? actionError.body : null;
    if (typeof body !== "object" || body === null || !("error" in body)) return fallback;
    const apiError = body.error;
    if (typeof apiError !== "object" || apiError === null || !("message" in apiError)) {
      return fallback;
    }
    return typeof apiError.message === "string" ? apiError.message : fallback;
  }

  useEffect(() => {
    if (mode !== "existing" || !selectedCardTypeId) return;
    const selected = cardTypes.find((cardType) => cardType.id === selectedCardTypeId);
    if (!selected) return;
    setDraft(draftFromCardType(selected));
  }, [cardTypes, mode, selectedCardTypeId]);

  useEffect(() => {
    if (!hasDraftChanges || isSaving || isDeleting) return;
    const timeout = window.setTimeout(() => void saveDraft(), 700);
    return () => window.clearTimeout(timeout);
  }, [draft, mode, selectedCardTypeId, isSaving, isDeleting]);

  async function selectExisting(cardType: V2CardType) {
    if (isSaving || isDeleting) return;
    if (hasDraftChanges && !(await saveDraft())) return;
    setMode("existing");
    setSelectedCardTypeId(cardType.id);
    setDraft(draftFromCardType(cardType));
    setError(null);
    setMessage(null);
  }

  async function selectNewType() {
    if (isSaving || isDeleting) return;
    if (hasDraftChanges && !(await saveDraft())) return;
    setMode("new");
    setSelectedCardTypeId(null);
    setDraft(emptyDraft());
    setError(null);
    setMessage(null);
  }

  function updateDraft(patch: Partial<Omit<CardTypeDraft, "id">>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
    setMessage(null);
  }

  function validateDraft() {
    const key = draft.key.trim();
    const name = draft.name.trim();
    if (!key) return "Key is required.";
    if (!CARD_TYPE_KEY_PATTERN.test(key)) {
      return "Key must start with a lowercase letter and use lowercase letters, numbers, or underscores.";
    }
    if (!name) return "Name is required.";
    const width = Number(draft.defaultWidth);
    const height = Number(draft.defaultHeight);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      return "Default size is invalid.";
    }
    if (!ACCENT_OPTIONS.some((option) => option.key === draft.accentKey.trim())) {
      return "Accent is required.";
    }
    if (!V2_CARD_TYPE_ICON_OPTIONS.some((option) => option.key === draft.iconKey.trim())) {
      return "Icon is required.";
    }
    const duplicate = cardTypes.some(
      (cardType) => cardType.key === key && cardType.id !== draft.id
    );
    if (duplicate) return "Card type key must be unique.";
    return null;
  }

  async function saveDraft(): Promise<boolean> {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return false;
    }
    const schemaResult = buildV2CardTypeSchemaFromDrafts(draft.fields);
    if (!schemaResult.ok) {
      setError(schemaResult.error);
      return false;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const defaultSize = {
        width: Number(draft.defaultWidth),
        height: Number(draft.defaultHeight),
      };
      const defaultVisualStyle = buildDefaultVisualStyle(draft);
      const ports = buildDefaultPorts(draft);
      if (mode === "new") {
        const created = await onCreateCardType({
          key: draft.key.trim(),
          name: draft.name.trim(),
          description: draft.description,
          schema: schemaResult.schema,
          defaultSize,
          defaultVisualStyle,
          ports,
        });
        setMode("existing");
        setSelectedCardTypeId(created.id);
        setDraft(draftFromCardType(created));
        setMessage("Card type created.");
        return true;
      }

      if (!draft.id) {
        setError("Select a card type to update.");
        return false;
      }
      const updated = await onUpdateCardType(draft.id, {
        key: draft.key.trim(),
        name: draft.name.trim(),
        description: draft.description,
        schema: schemaResult.schema,
        defaultSize,
        defaultVisualStyle,
        ports,
      });
      setDraft(draftFromCardType(updated));
      setMessage("Card type saved.");
      return true;
    } catch {
      setError("Could not save card type.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDraft() {
    if (mode !== "existing" || !draft.id || isSaving || isDeleting) return;
    const confirmed = window.confirm(
      `Delete card type "${draft.name.trim() || draft.key.trim()}"?\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await onDeleteCardType(draft.id);
      const nextType = sortedCardTypes.find((cardType) => cardType.id !== draft.id) ?? null;
      if (nextType) {
        setMode("existing");
        setSelectedCardTypeId(nextType.id);
        setDraft(draftFromCardType(nextType));
      } else {
        setMode("new");
        setSelectedCardTypeId(null);
        setDraft(emptyDraft());
      }
      setMessage("Card type deleted.");
    } catch (actionError) {
      setError(actionErrorMessage(actionError, "Could not delete card type."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function closeManager() {
    if (hasDraftChanges) {
      if (!(await saveDraft())) return;
    }
    onClose();
  }

  return (
    <div
      ref={dialogRef}
      className="v2ModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Card Type Manager"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          void closeManager();
        }
      }}
    >
      <section className="v2CardTypeManager" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CardTypeManagerHeader">
          <div>
            <h2>Card Type Manager</h2>
            <p>Edit type definitions used by all cards on this board.</p>
          </div>
          <button type="button" className="v2InspectorCloseButton" aria-label="Close manager" onClick={() => void closeManager()}>
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="v2CardTypeManagerBody">
          <aside className="v2CardTypeManagerList" aria-label="Card types">
            <button
              type="button"
              className={`v2CardTypeManagerNewButton${mode === "new" ? " v2CardTypeManagerRowActive" : ""}`}
              onClick={() => void selectNewType()}
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>New type</span>
            </button>
            {sortedCardTypes.length === 0 ? (
              <p className="v2InspectorEmpty">No card types yet.</p>
            ) : (
              sortedCardTypes.map((cardType) => {
                const Icon = getV2CardTypeIcon(cardType);
                const accentKey = resolveCardTypeAccentKey(cardType);
                return (
                  <button
                    key={cardType.id}
                    type="button"
                    className={`v2CardTypeManagerRow${
                      selectedCardTypeId === cardType.id && mode === "existing"
                        ? " v2CardTypeManagerRowActive"
                        : ""
                    }`}
                    style={{
                      ["--v2-manager-row-accent" as string]: `var(--yd-accent-${accentKey}-solid)`,
                      ["--v2-manager-row-accent-soft" as string]: `var(--yd-accent-${accentKey}-soft)`,
                    }}
                  onClick={() => void selectExisting(cardType)}
                  >
                    <span className="v2CardTypeManagerRowIcon" aria-hidden="true">
                      <Icon size={15} strokeWidth={2.1} />
                    </span>
                    <span className="v2CardTypeManagerRowText">
                      <strong>{cardType.name}</strong>
                      <span>{cardType.key}</span>
                    </span>
                  </button>
                );
              })
            )}
          </aside>

          <div className="v2CardTypeManagerEditor">
            <V2CardTypePreview
              typeKey={draft.key}
              name={draft.name}
              description={draft.description}
              accentKey={draft.accentKey}
              iconKey={draft.iconKey}
              fields={draft.fields}
              hasInputPort={draft.hasInputPort}
              hasOutputPort={draft.hasOutputPort}
            />

            <section className="v2CardTypeManagerSection">
              <div className="v2CardTypeManagerSectionHeader">
                <div>
                  <h3>{mode === "new" ? "New card type" : "Type details"}</h3>
                  <span>Type metadata is stored on the card type, not on cards.</span>
                </div>
              </div>
              <div className="v2CardTypeManagerDetailsGrid">
                <label>
                  <span>Key</span>
                  <input
                    className="v2InspectorDataValue"
                    value={draft.key}
                    placeholder="supplier"
                    disabled={isSaving || isDeleting}
                    onChange={(event) => updateDraft({ key: event.target.value })}
                  />
                </label>
                <label>
                  <span>Name</span>
                  <input
                    className="v2InspectorDataValue"
                    value={draft.name}
                    placeholder="Supplier"
                    disabled={isSaving || isDeleting}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                  />
                </label>
              </div>
              <label className="v2CardTypeManagerDescriptionField">
                <span>Description</span>
                <textarea
                  className="v2InspectorDataValue"
                  value={draft.description}
                  placeholder="What this card type represents"
                  disabled={isSaving || isDeleting}
                  rows={3}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </label>
            </section>

            <V2CardTypeSchemaEditor
              fields={draft.fields}
              disabled={isSaving || isDeleting}
              onChange={(fields) => updateDraft({ fields })}
            />

            <section className="v2CardTypeManagerSection">
              <h3>Visual defaults</h3>
              <p>Type appearance is rendered from card type metadata.</p>
              <div className="v2CardTypeVisualGrid">
                <div className="v2CardTypeChoiceGroup">
                  <span>Accent</span>
                  <div className="v2CardTypeAccentPicker">
                    {ACCENT_OPTIONS.map((option) => {
                      const isSelected = draft.accentKey === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`v2CardTypeAccentOption${
                            isSelected ? " v2CardTypeAccentOptionActive" : ""
                          }`}
                          disabled={isSaving || isDeleting}
                          style={{
                            ["--v2-accent-option-solid" as string]: `var(--yd-accent-${option.key}-solid)`,
                            ["--v2-accent-option-soft" as string]: `var(--yd-accent-${option.key}-soft)`,
                          }}
                          aria-pressed={isSelected}
                          onClick={() => updateDraft({ accentKey: option.key })}
                        >
                          <span className="v2CardTypeAccentSwatch" aria-hidden="true" />
                          <span>{option.label}</span>
                          {isSelected ? <Check size={13} strokeWidth={2.4} aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="v2CardTypeChoiceGroup">
                  <span>Icon</span>
                  <div className="v2CardTypeIconPicker">
                    {V2_CARD_TYPE_ICON_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = draft.iconKey === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`v2CardTypeIconOption${
                            isSelected ? " v2CardTypeIconOptionActive" : ""
                          }`}
                          disabled={isSaving || isDeleting}
                          aria-pressed={isSelected}
                          title={option.label}
                          onClick={() => updateDraft({ iconKey: option.key })}
                        >
                          <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className="v2CardTypeManagerSection">
              <h3>Default ports</h3>
              <p>Ports are type-level connection handles. New custom types start with input and output.</p>
              <div className="v2CardTypePortToggles">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.hasInputPort}
                    disabled={isSaving || isDeleting}
                    onChange={(event) => updateDraft({ hasInputPort: event.target.checked })}
                  />
                  <span>Input port</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.hasOutputPort}
                    disabled={isSaving || isDeleting}
                    onChange={(event) => updateDraft({ hasOutputPort: event.target.checked })}
                  />
                  <span>Output port</span>
                </label>
              </div>
            </section>

            {error ? <p className="v2InspectorDataError">{error}</p> : null}
            {message ? <p className="v2CardTypeManagerSuccess">{message}</p> : null}

            <div className="v2InspectorEditActions v2CardTypeManagerActions">
              {mode === "existing" ? (
                <button
                  type="button"
                  className="v2CardTypeManagerDeleteAction"
                  onClick={() => void deleteDraft()}
                  disabled={isSaving || isDeleting}
                >
                  <Trash2 size={13} strokeWidth={2.2} />
                  <span>{isDeleting ? "Deleting..." : "Delete type"}</span>
                </button>
              ) : <span />}
              <div className="v2CardTypeManagerSaveActions">
                {mode === "existing" ? (
                  <span>{error ? "Auto-save failed" : isSaving || hasDraftChanges ? "Saving..." : "Saved"}</span>
                ) : (
                  <button
                    type="button"
                    className="v2InspectorPrimaryAction"
                    onClick={() => void saveDraft()}
                    disabled={isSaving || isDeleting}
                  >
                    <Plus size={13} strokeWidth={2.2} />
                    <span>{isSaving ? "Creating..." : "Create card type"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
