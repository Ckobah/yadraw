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

type V2CardInspectorProps = {
  card: V2Card;
  cardType: V2CardType | null;
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
  saveStatus: SaveStatus;
  onUpdateCardBasics: (
    cardId: string,
    input: { title?: string; description?: string | null }
  ) => Promise<void>;
  onUpdateCardData: (
    cardId: string,
    data: Record<string, unknown>
  ) => Promise<void>;
  onDuplicateCard: (cardId: string) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onClose: () => void;
};

export function V2CardInspector({
  card,
  cardType,
  incomingConnections,
  outgoingConnections,
  cardById,
  saveStatus,
  onUpdateCardBasics,
  onUpdateCardData,
  onDuplicateCard,
  onDeleteCard,
  onClose,
}: V2CardInspectorProps) {
  const accentColor = getV2CardAccentColor(cardType?.key);

  function handleDeleteClick() {
    if (!window.confirm("Delete this card?")) return;
    void onDeleteCard(card.id);
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
        <button
          type="button"
          className="v2InspectorDuplicateButton"
          onClick={() => void onDuplicateCard(card.id)}
        >
          <Copy size={14} strokeWidth={2.2} />
          <span>Duplicate</span>
        </button>
        <button
          type="button"
          className="v2InspectorDeleteButton"
          onClick={handleDeleteClick}
        >
          <Trash2 size={14} strokeWidth={2.2} />
          <span>Delete</span>
        </button>
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
