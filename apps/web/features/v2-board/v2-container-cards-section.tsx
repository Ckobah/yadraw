"use client";

import { Pin } from "lucide-react";
import type { V2Card, V2CardType } from "@yadraw/shared";

type Props = {
  container: V2Card;
  allCards: V2Card[];
  cardTypes: V2CardType[];
};

export function V2ContainerCardsSection({ container, allCards, cardTypes }: Props) {
  const cardTypeById = new Map(cardTypes.map((cardType) => [cardType.id, cardType]));
  const contentCards = allCards.filter((card) => card.containerId === container.id);

  return (
    <section className="v2InspectorSection v2ContainerCardsSection">
      <div className="v2InspectorSectionHeader">
        <div>
          <h3>Contents</h3>
          <span>Move cards across the Box boundary to update this group.</span>
        </div>
        <span
          className="v2ContainerCardsCount"
          aria-label={`${contentCards.length} cards inside`}
        >
          <Pin size={11} strokeWidth={2.4} />
          {contentCards.length}
        </span>
      </div>

      {contentCards.length > 0 ? (
        <div className="v2ContainerCardsList">
          {contentCards.map((card) => (
            <div className="v2ContainerCardRow v2ContainerCardRowReadOnly" key={card.id}>
              <span className="v2ContainerCardRowPin" aria-hidden="true">
                <Pin size={12} strokeWidth={2.2} />
              </span>
              <span className="v2ContainerCardRowText">
                <strong title={card.title}>{card.title}</strong>
                <small>{cardTypeById.get(card.cardTypeId)?.name ?? "Card"}</small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="v2ContainerCardsEmpty">Move a card inside this Box to add it.</p>
      )}
    </section>
  );
}
