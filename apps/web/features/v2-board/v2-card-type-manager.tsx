"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, X } from "lucide-react";
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
  onClose: () => void;
};

const CARD_TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const ACCENT_OPTIONS = ["blue", "green", "orange", "red", "purple", "gray"] as const;
const ICON_OPTIONS = ["database", "task", "box", "user", "file", "gear", "truck", "factory", "material"];

function draftFromCardType(cardType: V2CardType): CardTypeDraft {
  return {
    id: cardType.id,
    key: cardType.key,
    name: cardType.name,
    description: cardType.description,
    fields: createV2CardTypeSchemaFieldDrafts(cardType.schema),
    defaultWidth: String(cardType.defaultSize.width),
    defaultHeight: String(cardType.defaultSize.height),
    accentKey: resolveCardTypeAccentKey(cardType),
    iconKey: cardType.defaultVisualStyle.iconKey ?? cardType.key,
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
    defaultWidth: "300",
    defaultHeight: "180",
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
  onClose,
}: V2CardTypeManagerProps) {
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

  useEffect(() => {
    if (mode !== "existing" || !selectedCardTypeId) return;
    const selected = cardTypes.find((cardType) => cardType.id === selectedCardTypeId);
    if (!selected) return;
    setDraft(draftFromCardType(selected));
  }, [cardTypes, mode, selectedCardTypeId]);

  function selectExisting(cardType: V2CardType) {
    setMode("existing");
    setSelectedCardTypeId(cardType.id);
    setDraft(draftFromCardType(cardType));
    setError(null);
    setMessage(null);
  }

  function selectNewType() {
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
    if (!Number.isFinite(width) || width <= 0) return "Default width must be greater than 0.";
    if (!Number.isFinite(height) || height <= 0) return "Default height must be greater than 0.";
    if (!ACCENT_OPTIONS.includes(draft.accentKey.trim() as (typeof ACCENT_OPTIONS)[number])) {
      return "Accent is required.";
    }
    if (!draft.iconKey.trim()) {
      return "Icon is required.";
    }
    const duplicate = cardTypes.some(
      (cardType) => cardType.key === key && cardType.id !== draft.id
    );
    if (duplicate) return "Card type key must be unique.";
    return null;
  }

  function resetDraft() {
    if (mode === "new") {
      setDraft(emptyDraft());
      return;
    }
    const selected = cardTypes.find((cardType) => cardType.id === selectedCardTypeId);
    if (selected) {
      setDraft(draftFromCardType(selected));
    }
    setError(null);
    setMessage(null);
  }

  async function saveDraft() {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    const schemaResult = buildV2CardTypeSchemaFromDrafts(draft.fields);
    if (!schemaResult.ok) {
      setError(schemaResult.error);
      return;
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
        return;
      }

      if (!draft.id) {
        setError("Select a card type to update.");
        return;
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
    } catch {
      setError("Could not save card type.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="v2ModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Card Type Manager"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="v2CardTypeManager" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CardTypeManagerHeader">
          <div>
            <h2>Card Type Manager</h2>
            <p>Edit type definitions used by all cards on this board.</p>
          </div>
          <button type="button" className="v2InspectorCloseButton" aria-label="Close manager" onClick={onClose}>
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="v2CardTypeManagerBody">
          <aside className="v2CardTypeManagerList" aria-label="Card types">
            <button
              type="button"
              className={`v2CardTypeManagerNewButton${mode === "new" ? " v2CardTypeManagerRowActive" : ""}`}
              onClick={selectNewType}
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>New type</span>
            </button>
            {sortedCardTypes.length === 0 ? (
              <p className="v2InspectorEmpty">No card types yet.</p>
            ) : (
              sortedCardTypes.map((cardType) => (
                <button
                  key={cardType.id}
                  type="button"
                  className={`v2CardTypeManagerRow${
                    selectedCardTypeId === cardType.id && mode === "existing"
                      ? " v2CardTypeManagerRowActive"
                      : ""
                  }`}
                  onClick={() => selectExisting(cardType)}
                >
                  <strong>{cardType.name}</strong>
                  <span>{cardType.key}</span>
                </button>
              ))
            )}
          </aside>

          <div className="v2CardTypeManagerEditor">
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
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ key: event.target.value })}
                  />
                </label>
                <label>
                  <span>Name</span>
                  <input
                    className="v2InspectorDataValue"
                    value={draft.name}
                    placeholder="Supplier"
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <V2CardTypeSchemaEditor
              fields={draft.fields}
              disabled={isSaving}
              onChange={(fields) => updateDraft({ fields })}
            />

            <section className="v2CardTypeManagerSection">
              <h3>Visual defaults</h3>
              <p>Type appearance is rendered as an accent, matching built-in Source and Task cards.</p>
              <div className="v2CardTypeVisualGrid">
                <label>
                  <span>Default width</span>
                  <input
                    className="v2InspectorDataValue"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.defaultWidth}
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ defaultWidth: event.target.value })}
                  />
                </label>
                <label>
                  <span>Default height</span>
                  <input
                    className="v2InspectorDataValue"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.defaultHeight}
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ defaultHeight: event.target.value })}
                  />
                </label>
                <label>
                  <span>Accent</span>
                  <select
                    className="v2InspectorDataValue"
                    value={draft.accentKey}
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ accentKey: event.target.value })}
                  >
                    {ACCENT_OPTIONS.map((accentKey) => (
                      <option key={accentKey} value={accentKey}>
                        {accentKey}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Icon</span>
                  <select
                    className="v2InspectorDataValue"
                    value={draft.iconKey}
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ iconKey: event.target.value })}
                  >
                    {ICON_OPTIONS.map((iconKey) => (
                      <option key={iconKey} value={iconKey}>
                        {iconKey}
                      </option>
                    ))}
                  </select>
                </label>
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
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ hasInputPort: event.target.checked })}
                  />
                  <span>Input port</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.hasOutputPort}
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ hasOutputPort: event.target.checked })}
                  />
                  <span>Output port</span>
                </label>
              </div>
            </section>

            {error ? <p className="v2InspectorDataError">{error}</p> : null}
            {message ? <p className="v2CardTypeManagerSuccess">{message}</p> : null}

            <div className="v2InspectorEditActions v2CardTypeManagerActions">
              <button type="button" onClick={resetDraft} disabled={isSaving}>
                Cancel changes
              </button>
              <button
                type="button"
                className="v2InspectorPrimaryAction"
                onClick={() => void saveDraft()}
                disabled={isSaving}
              >
                <Save size={13} strokeWidth={2.2} />
                <span>{isSaving ? "Saving..." : "Save card type"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
