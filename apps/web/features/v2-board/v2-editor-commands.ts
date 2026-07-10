import type { V2Card, V2CardVisualStyle } from "@yadraw/shared";

export type V2ClipboardCard = {
  localKey: string;
  cardTypeId: string;
  title: string;
  description: string;
  data: Record<string, unknown>;
  size: { width: number; height: number };
  visualStyle: V2CardVisualStyle;
  position: { x: number; y: number };
};

export type V2ClipboardPayload = {
  type: "yadraw/v2-selection";
  version: 1;
  cards: V2ClipboardCard[];
  connections: [];
};

export type V2EditorCommand = {
  label: string;
  execute(): Promise<void>;
  undo?: () => Promise<void>;
};

export function buildV2ClipboardPayload(cards: V2Card[]): V2ClipboardPayload {
  return {
    type: "yadraw/v2-selection",
    version: 1,
    cards: cards.map((card, index) => ({
      localKey: `card-${index + 1}`,
      cardTypeId: card.cardTypeId,
      title: card.title,
      description: card.description,
      data: structuredClone(card.data),
      size: { ...card.size },
      visualStyle: structuredClone(card.visualStyle),
      position: { ...card.position },
    })),
    connections: [],
  };
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "form",
        "[contenteditable]:not([contenteditable='false'])",
        "[role='textbox']",
        "[role='searchbox']",
        "[role='combobox']",
        "[role='dialog']",
        "[aria-modal='true']",
        "[role='menu']",
        "[role='menuitem']",
        "[role='toolbar']",
        "button",
        "a",
      ].join(",")
    )
  );
}
