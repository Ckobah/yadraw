"use client";

import { useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import type { V2Card, V2CardType, V2Connection } from "@yadraw/shared";
import {
  formatLinkedFieldValue,
  resolveV2LinkedFieldDrafts,
  type V2LinkedFieldDirection,
  type V2LinkedFieldDraft,
} from "./v2-linked-fields";

type V2LinkedFieldsPreviewProps = {
  card: V2Card;
  cardTypes: V2CardType[];
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
  allCards: V2Card[];
  allConnections: V2Connection[];
  drafts: V2LinkedFieldDraft[];
  onAddDraft: (draft: V2LinkedFieldDraft) => void;
  onRemoveDraft: (draftId: string) => void;
};

function createLinkedFieldId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `linked-field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function connectedCardForConnection(
  connection: V2Connection,
  direction: V2LinkedFieldDirection
): string {
  return direction === "incoming" ? connection.sourceCardId : connection.targetCardId;
}

function dataFieldOptions(card: V2Card | null): string[] {
  return Object.keys(card?.data ?? {})
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `data.${key}`);
}

export function V2LinkedFieldsPreview({
  card,
  cardTypes,
  incomingConnections,
  outgoingConnections,
  cardById,
  allCards,
  allConnections,
  drafts,
  onAddDraft,
  onRemoveDraft,
}: V2LinkedFieldsPreviewProps) {
  const [targetField, setTargetField] = useState("");
  const [sourceMode, setSourceMode] = useState<"exactCard" | "connectedCard">("exactCard");
  const [direction, setDirection] = useState<V2LinkedFieldDirection>("incoming");
  const [sourceCardId, setSourceCardId] = useState("");
  const [sourceFieldPath, setSourceFieldPath] = useState("data.inn");
  const [draftError, setDraftError] = useState<string | null>(null);

  const cardTypeById = useMemo(
    () => new Map(cardTypes.map((cardType) => [cardType.id, cardType])),
    [cardTypes]
  );
  const targetDrafts = drafts.filter((draft) => draft.targetCardId === card.id);
  const resolvedFields = resolveV2LinkedFieldDrafts({
    drafts: targetDrafts,
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
      ? "This key already exists in stored card data. Preview will not overwrite it."
      : null;
  const dynamicModeWarning =
    sourceMode === "connectedCard" && selectedSourceCard && !selectedSourceType
      ? "Dynamic mode needs a stable source card type. Use exact card mode for now."
      : null;

  function handleAddDraft() {
    const normalizedTargetField = targetField.trim();
    const normalizedSourceFieldPath = sourceFieldPath.trim();
    const sourceCard = sourceCardId ? cardById.get(sourceCardId) ?? null : connectedCards[0] ?? null;
    const sourceType = sourceCard ? cardTypeById.get(sourceCard.cardTypeId) ?? null : null;

    if (!normalizedTargetField) {
      setDraftError("Target field is required.");
      return;
    }
    if (!normalizedSourceFieldPath) {
      setDraftError("Source field path is required.");
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

    onAddDraft({
      id: createLinkedFieldId(),
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
    });

    setTargetField("");
    setDraftError(null);
  }

  return (
    <section className="v2InspectorSection v2LinkedFieldsSection">
      <div className="v2InspectorSectionHeader">
        <h3>Linked fields preview</h3>
        <span className="v2LinkedFieldsBadge">Preview only - not saved</span>
      </div>

      <div className="v2LinkedFieldsBuilder">
        <label className="v2LinkedFieldControl">
          <span>Target field</span>
          <input
            className="v2InspectorDataValue"
            value={targetField}
            placeholder="supplierInn"
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
            placeholder="data.inn"
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

        {selectedSourceType && sourceMode === "connectedCard" ? (
          <p className="v2LinkedFieldHint">
            Dynamic source type: {selectedSourceType.name} ({selectedSourceType.key})
          </p>
        ) : null}
        {targetKeyWarning ? <p className="v2LinkedFieldWarning">{targetKeyWarning}</p> : null}
        {dynamicModeWarning ? <p className="v2LinkedFieldWarning">{dynamicModeWarning}</p> : null}
        {draftError ? <p className="v2LinkedFieldError">{draftError}</p> : null}

        <button type="button" className="v2LinkedFieldAddButton" onClick={handleAddDraft}>
          <Link2 size={14} strokeWidth={2.3} />
          <span>Add preview field</span>
        </button>
      </div>

      {targetDrafts.length === 0 ? (
        <p className="v2InspectorEmpty">No linked field previews</p>
      ) : (
        <div className="v2LinkedFieldResultList">
          {targetDrafts.map((draft) => {
            const resolved = resolvedFields.find((field) => field.bindingId === draft.id);
            return (
              <div key={draft.id} className="v2LinkedFieldResultRow">
                <div className="v2LinkedFieldResultText">
                  <strong>{draft.targetField}</strong>
                  <span>{formatLinkedFieldValue(resolved?.value)}</span>
                  <em>
                    {draft.sourceMode === "connectedCard" ? "Dynamic" : "Exact"} · {draft.direction} ·{" "}
                    {draft.sourceFieldPath}
                  </em>
                  {resolved?.message ? <p>{resolved.message}</p> : null}
                </div>
                <button
                  type="button"
                  className="v2InspectorDataDeleteButton"
                  aria-label="Remove linked field preview"
                  onClick={() => onRemoveDraft(draft.id)}
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
