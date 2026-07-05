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

type CardTypeManagerMode = "existing" | "new";

type CardTypeDraft = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  fields: V2CardTypeSchemaFieldDraft[];
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

function draftFromCardType(cardType: V2CardType): CardTypeDraft {
  return {
    id: cardType.id,
    key: cardType.key,
    name: cardType.name,
    description: cardType.description,
    fields: createV2CardTypeSchemaFieldDrafts(cardType.schema),
  };
}

function emptyDraft(): CardTypeDraft {
  return {
    id: null,
    key: "",
    name: "",
    description: "",
    fields: [],
  };
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
      if (mode === "new") {
        const created = await onCreateCardType({
          key: draft.key.trim(),
          name: draft.name.trim(),
          description: draft.description,
          schema: schemaResult.schema,
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
                <label className="v2CardTypeManagerDescription">
                  <span>Description</span>
                  <textarea
                    className="v2InspectorDataValue v2InspectorDataJsonValue"
                    value={draft.description}
                    placeholder="Optional description"
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ description: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <V2CardTypeSchemaEditor
              fields={draft.fields}
              disabled={isSaving}
              onChange={(fields) => updateDraft({ fields })}
            />

            <section className="v2CardTypeManagerFuture">
              <h3>Visual defaults</h3>
              <p>Type color requires dedicated storage and is planned for a separate foundation update.</p>
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
