"use client";

import { Pin } from "lucide-react";
import type { V2Card, V2CardType } from "@yadraw/shared";
import { isV2CardPinnedToContainer } from "./v2-containers";

type Props = {
  container: V2Card;
  allCards: V2Card[];
  cardTypes: V2CardType[];
  pinPendingCardIds: ReadonlySet<string>;
  onSetContainerPinned: (cardIds: string[], pinned: boolean) => Promise<void>;
};

export function V2ContainerCardsSection({
  container,
  allCards,
  cardTypes,
  pinPendingCardIds,
  onSetContainerPinned,
}: Props) {
  const cardTypeById = new Map(cardTypes.map((cardType) => [cardType.id, cardType]));
  const contentCards = allCards.filter((card) => card.containerId === container.id);
  const hasPinnedCards = contentCards.some(isV2CardPinnedToContainer);
  const bulkActionPending = contentCards.some((card) => pinPendingCardIds.has(card.id));
  const bulkActionLabel = hasPinnedCards ? "Unpin all cards" : "Pin all cards";

  return (
    <section className="v2InspectorSection v2ContainerCardsSection">
      <div className="v2InspectorSectionHeader">
        <div>
          <h3>Contents</h3>
          <span>Unpinned cards stay listed but move independently.</span>
        </div>
        <button
          type="button"
          className="v2ContainerCardsCount"
          title={bulkActionLabel}
          aria-label={`${bulkActionLabel}. ${contentCards.length} cards in Box.`}
          disabled={contentCards.length === 0 || bulkActionPending}
          onClick={() => {
            void onSetContainerPinned(
              contentCards.map((card) => card.id),
              !hasPinnedCards
            ).catch(() => {});
          }}
        >
          <Pin
            className={hasPinnedCards ? undefined : "v2ContainerPinUnpinned"}
            size={11}
            strokeWidth={2.4}
          />
          {contentCards.length}
        </button>
      </div>

      {contentCards.length > 0 ? (
        <div className="v2ContainerCardsList">
          {contentCards.map((card) => {
            const pinned = isV2CardPinnedToContainer(card);
            return (
              <div className="v2ContainerCardRow v2ContainerCardRowReadOnly" key={card.id}>
                <button
                  type="button"
                  className={`v2ContainerCardRowPin${pinned ? "" : " v2ContainerPinUnpinned"}`}
                  title={pinned ? "Unpin from Box" : "Pin to Box"}
                  aria-label={`${pinned ? "Unpin" : "Pin"} ${card.title || "card"}`}
                  aria-pressed={pinned}
                  disabled={bulkActionPending}
                  onClick={() => {
                    void onSetContainerPinned([card.id], !pinned).catch(() => {});
                  }}
                >
                  <Pin size={12} strokeWidth={2.2} />
                </button>
                <span className="v2ContainerCardRowText">
                  <strong title={card.title}>{card.title}</strong>
                  <small>{cardTypeById.get(card.cardTypeId)?.name ?? "Card"}</small>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="v2ContainerCardsEmpty">Move a card inside this Box to add it.</p>
      )}
    </section>
  );
}
