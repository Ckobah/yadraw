"use client";

import { Link2, Pin, Unlink } from "lucide-react";
import type { V2Card, V2CardType } from "@yadraw/shared";
import type { ReactNode } from "react";
import { getV2CardsInsideContainer } from "./v2-containers";

type Props = {
  container: V2Card;
  allCards: V2Card[];
  cardTypes: V2CardType[];
  pending: boolean;
  onAttachCards: (containerId: string, cardIds: string[]) => Promise<void>;
  onDetachCards: (containerId: string, cardIds: string[]) => Promise<void>;
};

export function V2ContainerCardsSection({
  container,
  allCards,
  cardTypes,
  pending,
  onAttachCards,
  onDetachCards,
}: Props) {
  const cardTypeById = new Map(cardTypes.map((cardType) => [cardType.id, cardType]));
  const insideCards = getV2CardsInsideContainer(container, allCards, cardTypeById);
  const insideCardIds = new Set(insideCards.map((card) => card.id));
  const attachedCards = allCards.filter((card) => card.containerId === container.id);
  const availableInsideCards = insideCards.filter((card) => !card.containerId);
  const assignedElsewhereCards = insideCards.filter(
    (card) => card.containerId && card.containerId !== container.id
  );
  const attachableCards = [...availableInsideCards, ...assignedElsewhereCards];

  function attach(cardIds: string[]) {
    if (pending || cardIds.length === 0) return;
    void onAttachCards(container.id, cardIds).catch(() => {});
  }

  function detach(cardIds: string[]) {
    if (pending || cardIds.length === 0) return;
    void onDetachCards(container.id, cardIds).catch(() => {});
  }

  return (
    <section className="v2InspectorSection v2ContainerCardsSection">
      <div className="v2InspectorSectionHeader">
        <div>
          <h3>Cards</h3>
          <span>Attached cards move and change layers with this container.</span>
        </div>
        <span
          className="v2ContainerCardsCount"
          aria-label={`${attachedCards.length} attached cards`}
        >
          <Pin size={11} strokeWidth={2.4} />
          {attachedCards.length}
        </span>
      </div>

      <div className="v2ContainerCardsGroup">
        <div className="v2ContainerCardsGroupHeader">
          <strong>Attached</strong>
          {attachedCards.length > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => detach(attachedCards.map((card) => card.id))}
            >
              Detach all
            </button>
          ) : null}
        </div>
        {attachedCards.length > 0 ? (
          <div className="v2ContainerCardsList">
            {attachedCards.map((card) => (
              <ContainerCardRow
                key={card.id}
                card={card}
                cardType={cardTypeById.get(card.cardTypeId)}
                status={insideCardIds.has(card.id) ? "Inside" : "Outside"}
                actionLabel={`Detach ${card.title}`}
                actionIcon={<Unlink size={13} strokeWidth={2.2} />}
                pending={pending}
                onAction={() => detach([card.id])}
              />
            ))}
          </div>
        ) : (
          <p className="v2ContainerCardsEmpty">No attached cards yet.</p>
        )}
      </div>

      <div className="v2ContainerCardsGroup">
        <div className="v2ContainerCardsGroupHeader">
          <strong>Inside, not attached</strong>
          {availableInsideCards.length > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => attach(availableInsideCards.map((card) => card.id))}
            >
              Attach all
            </button>
          ) : null}
        </div>
        {attachableCards.length > 0 ? (
          <div className="v2ContainerCardsList">
            {attachableCards.map((card) => {
              const assignedElsewhere = Boolean(card.containerId);
              return (
                <ContainerCardRow
                  key={card.id}
                  card={card}
                  cardType={cardTypeById.get(card.cardTypeId)}
                  status={assignedElsewhere ? "Attached elsewhere" : "Available"}
                  actionLabel={`${assignedElsewhere ? "Move" : "Attach"} ${card.title}`}
                  actionIcon={<Link2 size={13} strokeWidth={2.2} />}
                  pending={pending}
                  onAction={() => attach([card.id])}
                />
              );
            })}
          </div>
        ) : (
          <p className="v2ContainerCardsEmpty">Place a card inside to make it available here.</p>
        )}
      </div>
    </section>
  );
}

function ContainerCardRow({
  card,
  cardType,
  status,
  actionLabel,
  actionIcon,
  pending,
  onAction,
}: {
  card: V2Card;
  cardType?: V2CardType;
  status: string;
  actionLabel: string;
  actionIcon: ReactNode;
  pending: boolean;
  onAction: () => void;
}) {
  return (
    <div className="v2ContainerCardRow">
      <span className="v2ContainerCardRowPin" aria-hidden="true">
        <Pin size={12} strokeWidth={2.2} />
      </span>
      <span className="v2ContainerCardRowText">
        <strong title={card.title}>{card.title}</strong>
        <small>{cardType?.name ?? "Card"} · {status}</small>
      </span>
      <button
        type="button"
        aria-label={actionLabel}
        title={actionLabel}
        disabled={pending}
        onClick={onAction}
      >
        {actionIcon}
      </button>
    </div>
  );
}
