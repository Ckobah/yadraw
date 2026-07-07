"use client";

import { Copy, Database, Trash2, X } from "lucide-react";
import type {
  V2Card,
  V2CardType,
  V2Connection,
  V2CreateLinkedFieldBindingRequest,
  V2LinkedFieldBinding,
  V2UpdateLinkedFieldBindingRequest,
} from "@yadraw/shared";
import { V2CardAdvancedSection } from "./v2-card-advanced-section";
import { V2CardAttachmentsSection } from "./v2-card-attachments-section";
import { V2CardBasicsSection } from "./v2-card-basics-section";
import { V2CardConnectionsSection } from "./v2-card-connections-section";
import { V2CardDataSection } from "./v2-card-data-section";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import { getV2CardTypeAccentColor } from "./v2-card-node";
import { V2LinkedFieldsPreview } from "./v2-linked-fields-preview";

type V2CardInspectorProps = {
  card: V2Card;
  cardType: V2CardType | null;
  cardTypes: V2CardType[];
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
  allCards: V2Card[];
  allConnections: V2Connection[];
  linkedFieldBindings: V2LinkedFieldBinding[];
  linkedFieldBindingsLoading: boolean;
  linkedFieldBindingsError: string | null;
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
  onManageCardType: (cardTypeId: string | null) => void;
  onCreateLinkedFieldBinding: (input: V2CreateLinkedFieldBindingRequest) => Promise<void>;
  onUpdateLinkedFieldBinding: (
    bindingId: string,
    input: V2UpdateLinkedFieldBindingRequest
  ) => Promise<void>;
  onDeleteLinkedFieldBinding: (bindingId: string) => Promise<void>;
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
  linkedFieldBindings,
  linkedFieldBindingsLoading,
  linkedFieldBindingsError,
  saveStatus,
  pendingAction,
  actionError,
  onUpdateCardBasics,
  onUpdateCardData,
  onManageCardType,
  onCreateLinkedFieldBinding,
  onUpdateLinkedFieldBinding,
  onDeleteLinkedFieldBinding,
  onDuplicateCard,
  onDeleteCard,
  onClose,
}: V2CardInspectorProps) {
  const accentColor = getV2CardTypeAccentColor(cardType);
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
          <button
            type="button"
            className="v2InspectorManageTypeButton"
            onClick={() => onManageCardType(cardType?.id ?? null)}
          >
            Manage type
          </button>
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
          cardType={cardType}
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
          bindings={linkedFieldBindings}
          schemaFieldKeys={cardType?.schema.fields.map((field) => field.key) ?? []}
          isLoading={linkedFieldBindingsLoading}
          error={linkedFieldBindingsError}
          onCreateBinding={onCreateLinkedFieldBinding}
          onUpdateBinding={onUpdateLinkedFieldBinding}
          onDeleteBinding={onDeleteLinkedFieldBinding}
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
