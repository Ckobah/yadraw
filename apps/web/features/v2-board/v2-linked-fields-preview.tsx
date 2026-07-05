"use client";

import { useMemo, useState } from "react";
import { Link2, Pencil, X } from "lucide-react";
import type {
  V2Card,
  V2CardType,
  V2Connection,
  V2CreateLinkedFieldBindingRequest,
  V2LinkedFieldBinding,
  V2UpdateLinkedFieldBindingRequest,
} from "@yadraw/shared";
import {
  formatLinkedFieldValue,
  resolveV2LinkedFieldDrafts,
  type V2LinkedFieldDirection,
} from "./v2-linked-fields";

type V2LinkedFieldsPreviewProps = {
  card: V2Card;
  cardTypes: V2CardType[];
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
  allCards: V2Card[];
  allConnections: V2Connection[];
  bindings: V2LinkedFieldBinding[];
  isLoading: boolean;
  error: string | null;
  onCreateBinding: (input: V2CreateLinkedFieldBindingRequest) => Promise<void>;
  onUpdateBinding: (bindingId: string, input: V2UpdateLinkedFieldBindingRequest) => Promise<void>;
  onDeleteBinding: (bindingId: string) => Promise<void>;
};

function connectedCardForConnection(
  connection: V2Connection,
  direction: V2LinkedFieldDirection
): string {
  return direction === "incoming" ? connection.sourceCardId : connection.targetCardId;
}

function dataFieldOptions(card: V2Card | null): string[] {
  const fields = Object.keys(card?.data ?? {})
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `data.${key}`);
  return ["title", "description", ...fields];
}

export function V2LinkedFieldsPreview({
  card,
  cardTypes,
  incomingConnections,
  outgoingConnections,
  cardById,
  allCards,
  allConnections,
  bindings,
  isLoading,
  error,
  onCreateBinding,
  onUpdateBinding,
  onDeleteBinding,
}: V2LinkedFieldsPreviewProps) {
  const [targetField, setTargetField] = useState("");
  const [sourceMode, setSourceMode] = useState<"exactCard" | "connectedCard">("exactCard");
  const [direction, setDirection] = useState<V2LinkedFieldDirection>("incoming");
  const [sourceCardId, setSourceCardId] = useState("");
  const [sourceFieldPath, setSourceFieldPath] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editingBindingId, setEditingBindingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const cardTypeById = useMemo(
    () => new Map(cardTypes.map((cardType) => [cardType.id, cardType])),
    [cardTypes]
  );
  const targetBindings = bindings.filter((binding) => binding.targetCardId === card.id);
  const resolvedFields = resolveV2LinkedFieldDrafts({
    bindings: targetBindings,
    targetCard: card,
    cards: allCards,
    connections: allConnections,
    cardTypes,
  });
  const activeConnections = direction === "incoming" ? incomingConnections : outgoingConnections;
  const connectedCards = activeConnections
    .map((connection) => cardById.get(connectedCardForConnection(connection, direction)))
    .filter((connectedCard): connectedCard is V2Card => Boolean(connectedCard));
  const selectedSourceCard = sourceCardId ? cardById.get(sourceCardId) ?? null : connectedCards[0] ?? null;
  const selectedSourceType = selectedSourceCard ? cardTypeById.get(selectedSourceCard.cardTypeId) ?? null : null;
  const sourceOptions = dataFieldOptions(selectedSourceCard);
  const targetKeyWarning =
    targetField.trim() && Object.prototype.hasOwnProperty.call(card.data ?? {}, targetField.trim())
      ? "This key already exists in stored card data. Linked field will not overwrite it."
      : null;
  const dynamicModeWarning =
    sourceMode === "connectedCard" && selectedSourceCard && !selectedSourceType
      ? "Dynamic mode needs a stable source card type. Use exact card mode for now."
      : null;

  function resetForm() {
    setTargetField("");
    setSourceMode("exactCard");
    setDirection("incoming");
    setSourceCardId("");
    setSourceFieldPath("");
    setEditingBindingId(null);
    setDraftError(null);
  }

  function beginEdit(binding: V2LinkedFieldBinding) {
    setTargetField(binding.targetField);
    setSourceMode(binding.sourceMode);
    setDirection(binding.direction);
    setSourceCardId(binding.sourceCardId ?? "");
    setSourceFieldPath(binding.sourceFieldPath);
    setEditingBindingId(binding.id);
    setDraftError(null);
  }

  async function handleSaveBinding() {
    const normalizedTargetField = targetField.trim();
    const normalizedSourceFieldPath = sourceFieldPath.trim();
    const sourceCard = sourceCardId ? cardById.get(sourceCardId) ?? null : connectedCards[0] ?? null;
    const sourceType = sourceCard ? cardTypeById.get(sourceCard.cardTypeId) ?? null : null;

    if (!normalizedTargetField) {
      setDraftError("Target field is required.");
      return;
    }
    if (!normalizedSourceFieldPath) {
      setDraftError("Source field is required.");
      return;
    }
    if (!sourceCard) {
      setDraftError("Choose a connected source card.");
      return;
    }
    if (sourceMode === "connectedCard" && !sourceType) {
      setDraftError("Dynamic mode needs a stable source card type. Use exact card mode for now.");
      return;
    }

    const input = {
      targetCardId: card.id,
      targetField: normalizedTargetField,
      direction,
      sourceCardId: sourceMode === "exactCard" ? sourceCard.id : undefined,
      sourceCardTypeId: sourceMode === "connectedCard" ? sourceType?.id ?? null : null,
      sourceCardTypeKey: sourceMode === "connectedCard" ? sourceType?.key ?? null : null,
      sourceFieldPath: normalizedSourceFieldPath,
      sourceMode,
      onMissing: "empty",
      onMultiple: "warning",
    } satisfies V2CreateLinkedFieldBindingRequest;

    setIsSaving(true);
    setDraftError(null);
    try {
      if (editingBindingId) {
        await onUpdateBinding(editingBindingId, input);
      } else {
        await onCreateBinding(input);
      }
      resetForm();
    } catch {
      setDraftError(editingBindingId ? "Could not save linked field changes." : "Could not save linked field.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="v2InspectorSection v2LinkedFieldsSection">
      <div className="v2InspectorSectionHeader">
        <h3>Linked fields</h3>
        <span className="v2LinkedFieldsBadge">Saved rule - resolved live</span>
      </div>

      <div className="v2LinkedFieldsBuilder">
        <div className="v2LinkedFieldDraftHeader">
          <span>{editingBindingId ? "Editing saved rule" : "Draft - not saved"}</span>
          {editingBindingId ? (
            <button type="button" onClick={resetForm}>
              Cancel edit
            </button>
          ) : null}
        </div>
        <label className="v2LinkedFieldControl">
          <span>Target field</span>
          <input
            className="v2InspectorDataValue"
            value={targetField}
            placeholder="linkedField"
            onChange={(event) => {
              setTargetField(event.target.value);
              setDraftError(null);
            }}
          />
        </label>

        <label className="v2LinkedFieldControl">
          <span>Source mode</span>
          <select
            className="v2InspectorDataValue"
            value={sourceMode}
            onChange={(event) => {
              setSourceMode(event.target.value as "exactCard" | "connectedCard");
              setDraftError(null);
            }}
          >
            <option value="exactCard">Exact connected card</option>
            <option value="connectedCard">Dynamic connected card by type/direction</option>
          </select>
        </label>

        <div className="v2LinkedFieldGrid">
          <label className="v2LinkedFieldControl">
            <span>Direction</span>
            <select
              className="v2InspectorDataValue"
              value={direction}
              onChange={(event) => {
                setDirection(event.target.value as V2LinkedFieldDirection);
                setSourceCardId("");
                setDraftError(null);
              }}
            >
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </label>
          <label className="v2LinkedFieldControl">
            <span>Source card</span>
            <select
              className="v2InspectorDataValue"
              value={sourceCardId}
              onChange={(event) => {
                setSourceCardId(event.target.value);
                setDraftError(null);
              }}
            >
              <option value="">Choose source</option>
              {connectedCards.map((sourceCard) => (
                <option key={sourceCard.id} value={sourceCard.id}>
                  {sourceCard.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="v2LinkedFieldControl">
          <span>Source field</span>
          <input
            className="v2InspectorDataValue"
            value={sourceFieldPath}
            list={`v2-linked-fields-${card.id}`}
            placeholder="data.key, title, description"
            onChange={(event) => {
              setSourceFieldPath(event.target.value);
              setDraftError(null);
            }}
          />
          <datalist id={`v2-linked-fields-${card.id}`}>
            {sourceOptions.map((fieldPath) => (
              <option key={fieldPath} value={fieldPath} />
            ))}
          </datalist>
        </label>
        {sourceOptions.length > 0 ? (
          <div className="v2LinkedFieldSuggestions" aria-label="Source field suggestions">
            {sourceOptions.map((fieldPath) => (
              <button
                key={fieldPath}
                type="button"
                onClick={() => {
                  setSourceFieldPath(fieldPath);
                  setDraftError(null);
                }}
              >
                {fieldPath}
              </button>
            ))}
          </div>
        ) : null}

        {selectedSourceType && sourceMode === "connectedCard" ? (
          <p className="v2LinkedFieldHint">
            Dynamic source type: {selectedSourceType.name} ({selectedSourceType.key})
          </p>
        ) : null}
        {targetKeyWarning ? <p className="v2LinkedFieldWarning">{targetKeyWarning}</p> : null}
        {dynamicModeWarning ? <p className="v2LinkedFieldWarning">{dynamicModeWarning}</p> : null}
        {draftError ? <p className="v2LinkedFieldError">{draftError}</p> : null}
        {error ? <p className="v2LinkedFieldError">{error}</p> : null}

        <button
          type="button"
          className="v2LinkedFieldAddButton"
          disabled={isSaving || isLoading}
          onClick={() => void handleSaveBinding()}
        >
          <Link2 size={14} strokeWidth={2.3} />
          <span>{editingBindingId ? "Save changes" : "Add linked field"}</span>
        </button>
      </div>

      {isLoading ? (
        <p className="v2InspectorEmpty">Loading linked fields...</p>
      ) : targetBindings.length === 0 ? (
        <p className="v2InspectorEmpty">No linked fields</p>
      ) : (
        <div className="v2LinkedFieldResultList">
          {targetBindings.map((binding) => {
            const resolved = resolvedFields.find((field) => field.bindingId === binding.id);
            return (
              <div key={binding.id} className="v2LinkedFieldResultRow">
                <div className="v2LinkedFieldResultText">
                  <strong>{binding.targetField}</strong>
                  <span>{formatLinkedFieldValue(resolved?.value)}</span>
                  <em>
                    {binding.sourceMode === "connectedCard" ? "Dynamic" : "Exact"} · {binding.direction} ·{" "}
                    {binding.sourceFieldPath}
                  </em>
                  {resolved?.message ? <p>{resolved.message}</p> : null}
                </div>
                <div className="v2LinkedFieldRowActions">
                  <button
                    type="button"
                    className="v2InspectorDataDeleteButton"
                    aria-label="Edit linked field"
                    onClick={() => beginEdit(binding)}
                  >
                    <Pencil size={14} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    className="v2InspectorDataDeleteButton"
                    aria-label="Remove linked field"
                    onClick={() => void onDeleteBinding(binding.id)}
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
