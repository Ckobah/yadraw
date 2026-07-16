"use client";

import { Database, Square, X } from "lucide-react";
import type {
  V2Card,
  V2CardAttachment,
  V2CalculationEvaluation,
  V2CardType,
  V2CardVisualStyle,
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
import { V2CardCalculatedSection } from "./v2-card-calculated-section";
import { V2CardLibrarySelector } from "../v2-card-library/v2-card-library-selector";
import { V2ContainerSettings } from "./v2-container-settings";
import { V2ContainerCardsSection } from "./v2-container-cards-section";
import { isV2ContainerCard } from "./v2-containers";

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
  calculationEvaluation: V2CalculationEvaluation | null;
  calculationLoading: boolean;
  calculationError: string | null;
  saveStatus: SaveStatus;
  pendingAction: "duplicate" | "delete" | null;
  fitPending: boolean;
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
  onUpdateVisualStyle: (cardId: string, patch: V2CardVisualStyle) => Promise<void>;
  onFitContainerToContent: (containerId: string) => Promise<void>;
  onSetLibraryEntry: (
    cardId: string,
    libraryEntryId: string | null,
    expectedLibraryEntryId: string | null
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
  calculationEvaluation,
  calculationLoading,
  calculationError,
  saveStatus,
  pendingAction,
  fitPending,
  actionError,
  attachments,
  attachmentsLoading,
  onUpdateCardBasics,
  onUpdateCardData,
  onUpdateVisualStyle,
  onFitContainerToContent,
  onSetLibraryEntry,
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
  const isContainer = isV2ContainerCard(card, cardType);
  const HeaderIcon = isContainer ? Square : Database;
  const containerContentCount = isContainer
    ? allCards.filter((candidate) => candidate.containerId === card.id).length
    : 0;

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
          <HeaderIcon size={18} strokeWidth={2.1} />
        </span>
        <div className="v2InspectorHeaderText">
          <span>{isContainer ? "Box" : "Card"}</span>
          <strong title={isContainer ? "Box" : cardType?.name}>
            {isContainer ? "Box" : cardType?.name ?? "Unknown type"}
          </strong>
        </div>
        <V2InspectorActionMenu
          disabled={actionsDisabled}
          onManage={isContainer ? undefined : () => onManageCardType(cardType?.id ?? null)}
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
        {cardType && !isContainer ? (
          <V2CardLibrarySelector
            card={card}
            cardType={cardType}
            onSetLibraryEntry={onSetLibraryEntry}
          />
        ) : null}
        <V2CardBasicsSection
          card={card}
          saveStatus={saveStatus}
          readOnly={Boolean(card.libraryEntryId)}
          onUpdateCardBasics={onUpdateCardBasics}
        />
        {isContainer ? (
          <>
            <V2ContainerSettings
              card={card}
              saveStatus={saveStatus}
              contentCount={containerContentCount}
              fitPending={fitPending}
              onUpdateVisualStyle={onUpdateVisualStyle}
              onFitToContent={onFitContainerToContent}
            />
            <V2ContainerCardsSection
              container={card}
              allCards={allCards}
              cardTypes={cardTypes}
            />
          </>
        ) : (
          <V2CardDataSection
            card={card}
            cardType={cardType}
            saveStatus={saveStatus}
            readOnly={Boolean(card.libraryEntryId)}
            onUpdateCardData={onUpdateCardData}
          />
        )}
        {!isContainer && (linkedFieldBindings.length > 0 || incomingConnections.length > 0 || outgoingConnections.length > 0) ? <V2LinkedFieldsPreview
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
        {!isContainer ? <V2CardCalculatedSection
          card={card}
          cardById={cardById}
          evaluation={calculationEvaluation}
          incidentConnectionIds={[
            ...incomingConnections.map((connection) => connection.id),
            ...outgoingConnections.map((connection) => connection.id)
          ]}
          isLoading={calculationLoading}
          error={calculationError}
        /> : null}
        {(incomingConnections.length + outgoingConnections.length) > 0 ? <V2CardConnectionsSection
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
        /> : null}
      </div>
    </aside>
  );
}
