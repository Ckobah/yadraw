"use client";

import { Database, X } from "lucide-react";
import type {
  V2Card,
  V2CardAttachment,
  V2CardType,
  V2Connection,
  V2CreateLinkedFieldBindingRequest,
  V2LinkedFieldBinding,
  V2UpdateLinkedFieldBindingRequest,
} from "@yadraw/shared";
import { V2CardAttachmentsSection } from "./v2-card-attachments-section";
import { V2CardBasicsSection } from "./v2-card-basics-section";
import { V2CardConnectionsSection } from "./v2-card-connections-section";
import { V2CardDataSection } from "./v2-card-data-section";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import { getV2CardTypeAccentColor } from "./v2-card-node";
import { V2LinkedFieldsPreview } from "./v2-linked-fields-preview";
import { V2InspectorActionMenu } from "./v2-inspector-action-menu";

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
  attachments: V2CardAttachment[] | undefined;
  attachmentsLoading: boolean;
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
  onLoadAttachments: (cardId: string) => Promise<V2CardAttachment[]>;
  onAttachmentsChange: (cardId: string, attachments: V2CardAttachment[]) => void;
  onOpenAttachment: (cardId: string, attachmentId: string) => void;
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
  attachments,
  attachmentsLoading,
  onUpdateCardBasics,
  onUpdateCardData,
  onManageCardType,
  onCreateLinkedFieldBinding,
  onUpdateLinkedFieldBinding,
  onDeleteLinkedFieldBinding,
  onDuplicateCard,
  onDeleteCard,
  onLoadAttachments,
  onAttachmentsChange,
  onOpenAttachment,
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
          <span>Card</span>
          <strong title={cardType?.name}>{cardType?.name ?? "Unknown type"}</strong>
        </div>
        <V2InspectorActionMenu
          disabled={actionsDisabled}
          onManage={() => onManageCardType(cardType?.id ?? null)}
          onDuplicate={handleDuplicateClick}
          onDelete={handleDeleteClick}
        />
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
        {actionError ? <p className="v2InspectorActionError" role="alert">{actionError}</p> : null}
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
        {(linkedFieldBindings.length > 0 || incomingConnections.length > 0 || outgoingConnections.length > 0) ? <V2LinkedFieldsPreview
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
        /> : null}
        <V2CardAttachmentsSection
          cardId={card.id}
          attachments={attachments}
          isLoading={attachmentsLoading}
          onLoad={onLoadAttachments}
          onAttachmentsChange={onAttachmentsChange}
          onPreview={onOpenAttachment}
        />
        {(incomingConnections.length + outgoingConnections.length) > 0 ? <V2CardConnectionsSection
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
        /> : null}
      </div>
    </aside>
  );
}
