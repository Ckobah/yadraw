"use client";

import { Copy, Database, Trash2, X } from "lucide-react";
import type { V2Card, V2CardType, V2Connection } from "@yadraw/shared";
import { V2CardAdvancedSection } from "./v2-card-advanced-section";
import { V2CardAttachmentsSection } from "./v2-card-attachments-section";
import { V2CardBasicsSection } from "./v2-card-basics-section";
import { V2CardConnectionsSection } from "./v2-card-connections-section";
import { V2CardDataSection } from "./v2-card-data-section";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import { getV2CardAccentColor } from "./v2-card-node";
import { V2LinkedFieldsPreview } from "./v2-linked-fields-preview";
import type { V2LinkedFieldDraft } from "./v2-linked-fields";

type V2CardInspectorProps = {
  card: V2Card;
  cardType: V2CardType | null;
  cardTypes: V2CardType[];
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
  allCards: V2Card[];
  allConnections: V2Connection[];
  linkedFieldDrafts: V2LinkedFieldDraft[];
  saveStatus: SaveStatus;
  pendingAction: "duplicate" | "delete" | null;
  actionError: string | null;
  onUpdateCardBasics: (
    cardId: string,
    input: { title?: string; description?: string | null }
  ) => Promise<void>;
  onUpdateCardData: (
    cardId: string,
    data: Record<string, unknown>
  ) => Promise<void>;
  onAddLinkedFieldDraft: (draft: V2LinkedFieldDraft) => void;
  onRemoveLinkedFieldDraft: (draftId: string) => void;
  onDuplicateCard: (cardId: string) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onClose: () => void;
};

export function V2CardInspector({
  card,
  cardType,
  cardTypes,
  incomingConnections,
  outgoingConnections,
  cardById,
  allCards,
  allConnections,
  linkedFieldDrafts,
  saveStatus,
  pendingAction,
  actionError,
  onUpdateCardBasics,
  onUpdateCardData,
  onAddLinkedFieldDraft,
  onRemoveLinkedFieldDraft,
  onDuplicateCard,
  onDeleteCard,
  onClose,
}: V2CardInspectorProps) {
  const accentColor = getV2CardAccentColor(cardType?.key);
  const actionsDisabled = pendingAction !== null;

  function handleDuplicateClick() {
    if (actionsDisabled) return;
    void onDuplicateCard(card.id).catch(() => {});
  }

  function handleDeleteClick() {
    if (actionsDisabled) return;
    void onDeleteCard(card.id).catch(() => {});
  }

  return (
    <aside
      className="v2CardInspector"
      style={{ ["--v2-inspector-accent" as string]: accentColor }}
      aria-label="Card inspector"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="v2InspectorHeader">
        <span className="v2InspectorTypeIcon" aria-hidden="true">
          <Database size={18} strokeWidth={2.1} />
        </span>
        <div className="v2InspectorHeaderText">
          <span>{cardType?.name ?? "Unknown type"}</span>
          <strong>{cardType?.key ?? "unknown"}</strong>
        </div>
        <div className="v2InspectorActions" aria-live="polite">
          <div className="v2InspectorActionRow">
            <button
              type="button"
              className="v2InspectorDuplicateButton"
              disabled={actionsDisabled}
              onClick={() => void handleDuplicateClick()}
            >
              <Copy size={14} strokeWidth={2.2} />
              <span>{pendingAction === "duplicate" ? "Duplicating..." : "Duplicate"}</span>
            </button>
            <button
              type="button"
              className="v2InspectorDeleteButton"
              disabled={actionsDisabled}
              onClick={() => void handleDeleteClick()}
            >
              <Trash2 size={14} strokeWidth={2.2} />
              <span>{pendingAction === "delete" ? "Deleting..." : "Delete"}</span>
            </button>
          </div>
          {actionError ? (
            <p className="v2InspectorActionError">{actionError}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="v2InspectorCloseButton"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>

      <div className="v2InspectorContent">
        <V2CardBasicsSection
          card={card}
          saveStatus={saveStatus}
          onUpdateCardBasics={onUpdateCardBasics}
        />
        <V2CardDataSection
          card={card}
          saveStatus={saveStatus}
          onUpdateCardData={onUpdateCardData}
        />
        <V2LinkedFieldsPreview
          card={card}
          cardTypes={cardTypes}
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
          allCards={allCards}
          allConnections={allConnections}
          drafts={linkedFieldDrafts}
          onAddDraft={onAddLinkedFieldDraft}
          onRemoveDraft={onRemoveLinkedFieldDraft}
        />
        <V2CardAttachmentsSection cardId={card.id} />
        <V2CardConnectionsSection
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
        />
        <V2CardAdvancedSection card={card} cardType={cardType} />
      </div>
    </aside>
  );
}
