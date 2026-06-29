"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Database, Plus } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import type { V2CardType, V2Position } from "@yadraw/shared";
import { getV2CardAccentColor } from "./v2-card-node";

type V2CardCreateToolbarProps = {
  cardTypes: V2CardType[];
  onCreateCard: (
    cardType: V2CardType,
    position: V2Position
  ) => Promise<void>;
};

export function V2CardCreateToolbar({
  cardTypes,
  onCreateCard,
}: V2CardCreateToolbarProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof globalThis.Node &&
        !toolbarRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isOpen]);

  function getCreatePosition(): V2Position {
    const canvas = toolbarRef.current?.closest(".react-flow");
    const rect = canvas?.getBoundingClientRect();
    const screenPosition = rect
      ? {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        }
      : {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };

    return screenToFlowPosition(screenPosition);
  }

  async function handleCreate(cardType: V2CardType) {
    setIsCreating(true);
    setError(null);
    try {
      await onCreateCard(cardType, getCreatePosition());
      setIsOpen(false);
    } catch {
      setError("Не удалось создать карточку");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div
      ref={toolbarRef}
      className="v2CreateToolbar nodrag nopan"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="v2CreateToolbarButton"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          setError(null);
          setIsOpen((current) => !current);
        }}
        disabled={isCreating || cardTypes.length === 0}
      >
        <Plus size={15} strokeWidth={2.4} />
        <span>Card</span>
        <ChevronDown size={14} strokeWidth={2.2} />
      </button>

      {isOpen ? (
        <div className="v2CreateToolbarPopover" role="menu">
          <span className="v2CreateToolbarTitle">Тип карточки</span>
          <div className="v2CreateTypeList">
            {cardTypes.map((cardType) => {
              const accentColor = getV2CardAccentColor(cardType.key);
              return (
                <button
                  key={cardType.id}
                  type="button"
                  role="menuitem"
                  className="v2CreateTypeButton"
                  onClick={() => void handleCreate(cardType)}
                  disabled={isCreating}
                  style={{ ["--v2-create-accent" as string]: accentColor }}
                >
                  <span className="v2CreateTypeIcon" aria-hidden="true">
                    <Database size={15} strokeWidth={2.1} />
                  </span>
                  <span className="v2CreateTypeText">
                    <strong>{cardType.name}</strong>
                    <em>{cardType.key}</em>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="v2CreateToolbarError">{error}</p> : null}
    </div>
  );
}
