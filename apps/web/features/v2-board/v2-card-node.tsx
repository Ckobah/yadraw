"use client";

import {
  Handle,
  NodeResizer,
  Position,
  useUpdateNodeInternals,
  type NodeProps
} from "@xyflow/react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MoreHorizontal } from "lucide-react";
import type {
  V2Card,
  V2Connection,
  V2LinkedFieldBinding,
  V2CardType,
  V2CardTypeFieldSchema,
  V2CardVisualStyle,
} from "@yadraw/shared";
import type { Node } from "@xyflow/react";
import {
  buildV2ConnectorSlots,
  clampEditableSlotOffset,
  toPersistedV2ConnectorSlot,
  toRuntimeV2ConnectorSlot,
  validateV2ConnectorSlots,
  type V2ConnectorSlot,
  type V2ConnectorSlotSide,
  type V2ConnectorSlotType,
  type V2PersistedConnectorSlot,
} from "./v2-connector-slots";
import {
  formatLinkedFieldValue,
  resolveV2LinkedFieldDrafts,
} from "./v2-linked-fields";
import { getV2CardTypeIcon } from "./v2-card-type-icons";
import { resolveCardTypeAccentKey } from "./v2-theme-tokens";

export type V2CardNodeData = {
  card: V2Card;
  cardType: V2CardType;
  allCards?: V2Card[];
  allConnections?: V2Connection[];
  cardTypes?: V2CardType[];
  linkedFieldBindings?: V2LinkedFieldBinding[];
  connectedPortKeys?: string[];
  isCardActionPending?: boolean;
  pendingCardAction?: "duplicate" | "delete" | null;
  cardActionError?: string | null;
  isVisualEditing?: boolean;
  onStartVisualEditor?: (cardId: string) => void;
  onDuplicateCard?: (cardId: string) => Promise<void> | void;
  onDeleteCard?: (cardId: string) => Promise<void> | void;
  onResizeCard?: (cardId: string, size: { width: number; height: number }) => void;
  onUpdateVisualStyle?: (cardId: string, patch: V2CardVisualStyle) => Promise<void> | void;
  onCloseVisualEditor?: () => void;
  onConnectorSlotDragStart?: () => void;
  onConnectorSlotDragEnd?: (moved: boolean) => void;
};

export type V2CardNode = Node<V2CardNodeData, "v2Card">;

export const V2_CARD_MIN_SIZE = {
  width: 172,
  height: 122,
} as const;

function getHandleType(slotType: V2ConnectorSlotType): "source" | "target" {
  return slotType === "output" ? "source" : "target";
}

function getHandleTypes(slotType: V2ConnectorSlotType): readonly ("source" | "target")[] {
  return slotType === "receiver" ? ["target", "source"] : [getHandleType(slotType)];
}

function getHandlePosition(side: V2ConnectorSlotSide): Position {
  if (side === "right") return Position.Right;
  if (side === "top") return Position.Top;
  if (side === "bottom") return Position.Bottom;
  return Position.Left;
}

function getSlotShapeClass(slotType: V2ConnectorSlotType): string {
  if (slotType === "output") return "v2CardHandleOutput";
  if (slotType === "receiver") return "v2CardHandleReceiver";
  return "v2CardHandleInput";
}

function getSlotSideClass(side: V2ConnectorSlotSide): string {
  if (side === "right") return "v2CardHandleSideRight";
  if (side === "top") return "v2CardHandleSideTop";
  if (side === "bottom") return "v2CardHandleSideBottom";
  return "v2CardHandleSideLeft";
}

function getSlotAddZoneSideClass(side: V2ConnectorSlotSide): string {
  if (side === "right") return "v2ConnectorSlotAddZoneRight";
  if (side === "bottom") return "v2ConnectorSlotAddZoneBottom";
  if (side === "left") return "v2ConnectorSlotAddZoneLeft";
  return "v2ConnectorSlotAddZoneTop";
}

function getSlotPositionStyle(slot: V2ConnectorSlot): CSSProperties {
  const offset = `${slot.offset * 100}%`;
  if (slot.side === "top" || slot.side === "bottom") {
    return { left: offset };
  }
  return { top: offset };
}

const CONNECTOR_SLOT_DIAMETER_PX = 20;
const CONNECTOR_SLOT_GAP_PX = 14;
const CONNECTOR_SLOT_MIN_CENTER_GAP_PX = CONNECTOR_SLOT_DIAMETER_PX + 4;
const SLOT_POPOVER_WIDTH_PX = 150;
const SLOT_POPOVER_HEIGHT_PX = 38;

function getSlotPopoverStyle(
  slot: V2ConnectorSlot,
  cardRect?: DOMRect
): CSSProperties {
  const offset = `${slot.offset * 100}%`;
  const hasTopSpace = !cardRect || cardRect.top >= SLOT_POPOVER_HEIGHT_PX + CONNECTOR_SLOT_GAP_PX;
  const hasBottomSpace =
    !cardRect ||
    window.innerHeight - cardRect.bottom >= SLOT_POPOVER_HEIGHT_PX + CONNECTOR_SLOT_GAP_PX;
  const hasLeftSpace = !cardRect || cardRect.left >= SLOT_POPOVER_WIDTH_PX + CONNECTOR_SLOT_GAP_PX;
  const hasRightSpace =
    !cardRect ||
    window.innerWidth - cardRect.right >= SLOT_POPOVER_WIDTH_PX + CONNECTOR_SLOT_GAP_PX;

  if (slot.side === "top") {
    return hasTopSpace
      ? {
          left: offset,
          bottom: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
          transform: "translateX(-50%)",
        }
      : {
          left: offset,
          top: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
          transform: "translateX(-50%)",
        };
  }
  if (slot.side === "bottom") {
    return hasBottomSpace
      ? {
          left: offset,
          top: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
          transform: "translateX(-50%)",
        }
      : {
          left: offset,
          bottom: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
          transform: "translateX(-50%)",
        };
  }
  if (slot.side === "right") {
    return hasRightSpace
      ? {
          left: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
          top: offset,
          transform: "translateY(-50%)",
        }
      : {
          right: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
          top: offset,
          transform: "translateY(-50%)",
        };
  }
  return hasLeftSpace
    ? {
        right: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
        top: offset,
        transform: "translateY(-50%)",
      }
    : {
        left: `calc(100% + ${CONNECTOR_SLOT_GAP_PX}px)`,
        top: offset,
        transform: "translateY(-50%)",
      };
}

function getPerimeterSlotFromPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  options: { requireNearEdge: boolean }
): { side: V2ConnectorSlotSide; offset: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const distances = [
    { side: "top" as const, value: Math.abs(clientY - rect.top) },
    { side: "right" as const, value: Math.abs(clientX - rect.right) },
    { side: "bottom" as const, value: Math.abs(clientY - rect.bottom) },
    { side: "left" as const, value: Math.abs(clientX - rect.left) },
  ].sort((a, b) => a.value - b.value);

  const nearest = distances[0];
  if (!nearest) return null;
  if (options.requireNearEdge && nearest.value > 22) return null;

  const rawOffset =
    nearest.side === "top" || nearest.side === "bottom"
      ? (clientX - rect.left) / rect.width
      : (clientY - rect.top) / rect.height;

  return {
    side: nearest.side,
    offset: clampEditableSlotOffset(rawOffset),
  };
}

function getOutsidePerimeterSlotFromPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number
): { side: V2ConnectorSlotSide; offset: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const diameter = CONNECTOR_SLOT_DIAMETER_PX;
  const candidates: Array<{
    side: V2ConnectorSlotSide;
    distance: number;
    offset: number;
  }> = [];

  if (
    clientY >= rect.top - diameter &&
    clientY <= rect.top &&
    clientX >= rect.left - diameter &&
    clientX <= rect.right + diameter
  ) {
    candidates.push({
      side: "top",
      distance: Math.abs(clientY - rect.top),
      offset: (clientX - rect.left) / rect.width,
    });
  }

  if (
    clientY >= rect.bottom &&
    clientY <= rect.bottom + diameter &&
    clientX >= rect.left - diameter &&
    clientX <= rect.right + diameter
  ) {
    candidates.push({
      side: "bottom",
      distance: Math.abs(clientY - rect.bottom),
      offset: (clientX - rect.left) / rect.width,
    });
  }

  if (
    clientX >= rect.left - diameter &&
    clientX <= rect.left &&
    clientY >= rect.top - diameter &&
    clientY <= rect.bottom + diameter
  ) {
    candidates.push({
      side: "left",
      distance: Math.abs(clientX - rect.left),
      offset: (clientY - rect.top) / rect.height,
    });
  }

  if (
    clientX >= rect.right &&
    clientX <= rect.right + diameter &&
    clientY >= rect.top - diameter &&
    clientY <= rect.bottom + diameter
  ) {
    candidates.push({
      side: "right",
      distance: Math.abs(clientX - rect.right),
      offset: (clientY - rect.top) / rect.height,
    });
  }

  const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return null;
  return {
    side: nearest.side,
    offset: clampEditableSlotOffset(nearest.offset),
  };
}

function createConnectorSlotId(existingIds: Set<string>): string {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    if (!existingIds.has(id)) return id;
  }
  return `slot-${Date.now().toString(36)}-${existingIds.size}`;
}

function getSlotSideLength(rect: DOMRect, side: V2ConnectorSlotSide): number {
  return Math.max(1, side === "top" || side === "bottom" ? rect.width : rect.height);
}

function hasSlotConflict(
  slots: V2PersistedConnectorSlot[],
  slotId: string,
  side: V2ConnectorSlotSide,
  offset: number,
  sideLength: number
): boolean {
  const pixelPosition = clampEditableSlotOffset(offset) * sideLength;
  return slots.some(
    (slot) =>
      slot.id !== slotId &&
      slot.side === side &&
      Math.abs(clampEditableSlotOffset(slot.offset) * sideLength - pixelPosition) <
        CONNECTOR_SLOT_MIN_CENTER_GAP_PX
  );
}

function resolveFreeSlotPosition(
  slots: V2PersistedConnectorSlot[],
  slotId: string,
  position: { side: V2ConnectorSlotSide; offset: number },
  sideLength: number
): { side: V2ConnectorSlotSide; offset: number } {
  const safeSideLength = Math.max(1, sideLength);
  const desiredOffset = clampEditableSlotOffset(position.offset);
  if (!hasSlotConflict(slots, slotId, position.side, desiredOffset, safeSideLength)) {
    return { side: position.side, offset: desiredOffset };
  }

  const desiredPixel = desiredOffset * safeSideLength;
  const maxPixel = safeSideLength;

  for (let distance = 1; distance <= maxPixel; distance += 1) {
    for (const direction of [-1, 1]) {
      const pixel = desiredPixel + direction * distance;
      if (pixel < 0 || pixel > maxPixel) continue;

      const offset = clampEditableSlotOffset(pixel / safeSideLength);
      if (!hasSlotConflict(slots, slotId, position.side, offset, safeSideLength)) {
        return { side: position.side, offset };
      }
    }
  }

  return { side: position.side, offset: desiredOffset };
}

function bodyVerticalJustify(
  value?: "top" | "center" | "bottom"
): "flex-start" | "center" | "flex-end" {
  if (value === "center") return "center";
  if (value === "bottom") return "flex-end";
  return "flex-start";
}

export function getV2CardTypeAccentColor(cardType: V2CardType | null | undefined): string {
  return `var(--yd-accent-${resolveCardTypeAccentKey(cardType)}-solid)`;
}

function getCardSummary(card: V2Card): string {
  if (card.description.trim()) return card.description.trim();
  const kind = card.data.kind;
  return typeof kind === "string" && kind.trim() ? kind.trim() : "No description";
}

type V2CardDataPreviewRow = {
  key: string;
  label: string;
  value: string;
  variant?: "data" | "linkedSource" | "linked";
};

const CARD_DATA_PREVIEW_ROW_HEIGHT_PX = 23;
const CARD_DATA_PREVIEW_ROW_GAP_PX = 5;
const CARD_DATA_PREVIEW_TOP_MARGIN_PX = 2;

function formatCardDataPreviewValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length > 0 ? `[${value.length} items]` : null;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return null;
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function buildSchemaPreviewRows(
  fields: V2CardTypeFieldSchema[],
  data: V2Card["data"]
): V2CardDataPreviewRow[] {
  return fields.flatMap((field) => {
    const value = formatCardDataPreviewValue(data[field.key]);
    return value
      ? [
          {
            key: field.key,
            label: field.label || field.key,
            value,
          },
        ]
      : [];
  });
}

function buildExtraDataPreviewRows(
  card: V2Card,
  schemaFields: V2CardTypeFieldSchema[]
): V2CardDataPreviewRow[] {
  const schemaKeys = new Set(schemaFields.map((field) => field.key));
  return Object.entries(card.data).flatMap(([key, rawValue]) => {
    if (schemaKeys.has(key) || key === "kind") return [];
    const value = formatCardDataPreviewValue(rawValue);
    return value ? [{ key, label: key, value }] : [];
  });
}

function buildCardDataPreviewRows(card: V2Card, cardType: V2CardType): V2CardDataPreviewRow[] {
  const schemaFields = cardType.schema.fields;
  return [
    ...buildSchemaPreviewRows(schemaFields, card.data),
    ...buildExtraDataPreviewRows(card, schemaFields),
  ];
}

function resolveLinkedFieldSourceCard(
  binding: V2LinkedFieldBinding,
  targetCard: V2Card,
  cards: V2Card[],
  connections: V2Connection[],
  cardTypes: V2CardType[]
): V2Card | null {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const cardTypeById = new Map(cardTypes.map((type) => [type.id, type]));

  if (binding.sourceMode === "exactCard") {
    if (!binding.sourceCardId || binding.sourceCardId === targetCard.id) return null;
    return cardById.get(binding.sourceCardId) ?? null;
  }

  const relatedSourceIds = connections.flatMap((connection) => {
    if (binding.direction === "incoming" && connection.targetCardId === targetCard.id) {
      return [connection.sourceCardId];
    }
    if (binding.direction === "outgoing" && connection.sourceCardId === targetCard.id) {
      return [connection.targetCardId];
    }
    return [];
  });

  const matchingSources = relatedSourceIds
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is V2Card => {
      if (!card || card.id === targetCard.id) return false;
      if (binding.sourceCardTypeId && card.cardTypeId !== binding.sourceCardTypeId) {
        return false;
      }
      if (binding.sourceCardTypeKey) {
        return cardTypeById.get(card.cardTypeId)?.key === binding.sourceCardTypeKey;
      }
      return true;
    });

  return matchingSources.length === 1 ? matchingSources[0] ?? null : null;
}

function buildLinkedFieldPreviewRows({
  targetCard,
  bindings,
  cards,
  connections,
  cardTypes,
}: {
  targetCard: V2Card;
  bindings: V2LinkedFieldBinding[];
  cards: V2Card[];
  connections: V2Connection[];
  cardTypes: V2CardType[];
}): V2CardDataPreviewRow[] {
  const targetBindings = bindings.filter(
    (binding) => binding.targetCardId === targetCard.id && binding.status === "active"
  );
  if (targetBindings.length === 0) return [];

  const resolvedByBindingId = new Map(
    resolveV2LinkedFieldDrafts({
      bindings: targetBindings,
      targetCard,
      cards,
      connections,
      cardTypes,
    }).map((resolved) => [resolved.bindingId, resolved])
  );
  const rows: V2CardDataPreviewRow[] = [];
  const sourceRowKeys = new Set<string>();

  for (const binding of targetBindings) {
    const resolved = resolvedByBindingId.get(binding.id);
    if (!resolved || resolved.status !== "resolved") continue;

    const value = formatLinkedFieldValue(resolved.value).trim();
    if (!value) continue;

    const sourceCard = resolveLinkedFieldSourceCard(
      binding,
      targetCard,
      cards,
      connections,
      cardTypes
    );
    if (!sourceCard) continue;

    if (!sourceRowKeys.has(sourceCard.id)) {
      sourceRowKeys.add(sourceCard.id);
      rows.push({
        key: `linked-source-${sourceCard.id}`,
        label: "Linked from",
        value: sourceCard.title,
        variant: "linkedSource",
      });
    }

    rows.push({
      key: `linked-${binding.id}`,
      label: binding.targetField,
      value,
      variant: "linked",
    });
  }

  return rows;
}

export function V2CardNodeComponent({ data, selected }: NodeProps<V2CardNode>) {
  const { card, cardType } = data;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const subtitleRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const accentKey = resolveCardTypeAccentKey(cardType);
  const accentColor = `var(--yd-accent-${accentKey}-solid)`;
  const CardTypeIcon = getV2CardTypeIcon(cardType);
  const storedDataPreviewRows = useMemo(
    () => buildCardDataPreviewRows(card, cardType),
    [card, cardType]
  );
  const linkedDataPreviewRows = useMemo(
    () =>
      buildLinkedFieldPreviewRows({
        targetCard: card,
        bindings: data.linkedFieldBindings ?? [],
        cards: data.allCards ?? [card],
        connections: data.allConnections ?? [],
        cardTypes: data.cardTypes ?? [cardType],
      }),
    [
      card,
      cardType,
      data.allCards,
      data.allConnections,
      data.cardTypes,
      data.linkedFieldBindings,
    ]
  );
  const dataPreviewRows = useMemo(
    () => [...storedDataPreviewRows, ...linkedDataPreviewRows],
    [storedDataPreviewRows, linkedDataPreviewRows]
  );
  const [visibleDataPreviewRowCount, setVisibleDataPreviewRowCount] = useState(
    dataPreviewRows.length
  );
  const visibleDataPreviewRows = dataPreviewRows.slice(0, visibleDataPreviewRowCount);
  const visualStyle = card.visualStyle ?? {};
  const connectorSlots = buildV2ConnectorSlots({
    visualStyle,
    ports: cardType.ports,
  });
  const connectorSlotSourceKey = JSON.stringify(
    connectorSlots.map((slot) => ({
      id: slot.id,
      type: slot.type,
      side: slot.side,
      offset: slot.offset,
      label: slot.label,
    }))
  );
  const [slotDraft, setSlotDraft] = useState<V2PersistedConnectorSlot[]>(() =>
    connectorSlots.map(toPersistedV2ConnectorSlot)
  );
  const [slotEditorError, setSlotEditorError] = useState<string | null>(null);
  const [typeChooserSlotId, setTypeChooserSlotId] = useState<string | null>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const slotDraftRef = useRef(slotDraft);
  const dragStartRef = useRef<{
    slotId: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const lastSlotDragMovedRef = useRef(false);
  const typeChooserTimerRef = useRef<number | null>(null);
  const renderedConnectorSlots =
    data.isVisualEditing
      ? slotDraft.map(toRuntimeV2ConnectorSlot)
      : connectorSlots;
  const renderedConnectorSlotKey = JSON.stringify(
    renderedConnectorSlots.map((slot) => ({
      id: slot.id,
      type: slot.type,
      side: slot.side,
      offset: slot.offset,
      label: slot.label,
    }))
  );
  const connectedPortKeys = new Set(data.connectedPortKeys ?? []);
  const typeChooserSlot =
    data.isVisualEditing && typeChooserSlotId
      ? renderedConnectorSlots.find((slot) => slot.id === typeChooserSlotId) ?? null
      : null;
  const textStyle = {
    fontFamily: visualStyle.fontFamily,
    textAlign: visualStyle.textAlign,
    color: visualStyle.textColor,
    fontWeight: visualStyle.fontWeight,
    fontStyle: visualStyle.fontStyle,
    textDecoration: visualStyle.textDecoration,
  };
  const cardBorderColor = selected ? "var(--v2-card-accent)" : "var(--yd-border-default)";

  useLayoutEffect(() => {
    function updateVisibleRows() {
      if (!bodyRef.current || dataPreviewRows.length === 0) {
        setVisibleDataPreviewRowCount(0);
        return;
      }

      const bodyHeight = bodyRef.current.clientHeight;
      const titleHeight = titleRef.current?.offsetHeight ?? 0;
      const subtitleHeight = subtitleRef.current?.offsetHeight ?? 0;
      const bodyStyle = window.getComputedStyle(bodyRef.current);
      const bodyGap = Number.parseFloat(bodyStyle.rowGap || bodyStyle.gap || "0") || 0;
      const reservedHeight =
        titleHeight + subtitleHeight + bodyGap * 2 + CARD_DATA_PREVIEW_TOP_MARGIN_PX;
      const availablePreviewHeight = Math.max(0, bodyHeight - reservedHeight);
      const nextCount = Math.min(
        dataPreviewRows.length,
        Math.floor(
          (availablePreviewHeight + CARD_DATA_PREVIEW_ROW_GAP_PX) /
            (CARD_DATA_PREVIEW_ROW_HEIGHT_PX + CARD_DATA_PREVIEW_ROW_GAP_PX)
        )
      );
      setVisibleDataPreviewRowCount((current) => (current === nextCount ? current : nextCount));
    }

    updateVisibleRows();

    const observer = new ResizeObserver(updateVisibleRows);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (titleRef.current) observer.observe(titleRef.current);
    if (subtitleRef.current) observer.observe(subtitleRef.current);
    return () => observer.disconnect();
  }, [
    card.size.height,
    card.size.width,
    card.title,
    card.description,
    dataPreviewRows,
    visualStyle.fontFamily,
    visualStyle.fontWeight,
    visualStyle.fontStyle,
    visualStyle.textDecoration,
  ]);

  useEffect(() => {
    if (!data.isVisualEditing) return;
    setSlotDraft(connectorSlots.map(toPersistedV2ConnectorSlot));
    setSlotEditorError(null);
    setTypeChooserSlotId(null);
  }, [card.id, connectorSlotSourceKey, data.isVisualEditing]);

  useEffect(() => {
    return () => {
      if (typeChooserTimerRef.current !== null) {
        window.clearTimeout(typeChooserTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    slotDraftRef.current = slotDraft;
  }, [slotDraft]);

  useEffect(() => {
    updateNodeInternals(card.id);
  }, [card.id, renderedConnectorSlotKey, updateNodeInternals]);

  useEffect(() => {
    if (!draggingSlotId) return;

    function handleWindowPointerMove(event: PointerEvent) {
      const dragStart = dragStartRef.current;
      const rect = articleRef.current?.getBoundingClientRect();
      if (!dragStart || !rect) return;

      if (
        !dragStart.moved &&
        Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 3
      ) {
        dragStart.moved = true;
      }

      if (!dragStart.moved) return;
      const position = getPerimeterSlotFromPoint(rect, event.clientX, event.clientY, {
        requireNearEdge: false,
      });
      if (!position) return;
      const sideLength = getSlotSideLength(rect, position.side);
      updateSlotDraft(
        dragStart.slotId,
        resolveFreeSlotPosition(slotDraftRef.current, dragStart.slotId, position, sideLength)
      );
    }

    function handleWindowPointerUp() {
      const shouldPersist = Boolean(dragStartRef.current?.moved);
      const nextDraft = slotDraftRef.current;
      dragStartRef.current = null;
      setDraggingSlotId(null);
      lastSlotDragMovedRef.current = shouldPersist;
      data.onConnectorSlotDragEnd?.(shouldPersist);
      if (shouldPersist) {
        void persistConnectorSlots(nextDraft);
      }
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [draggingSlotId]);

  function updateSlotDraft(
    slotId: string,
    patch: Partial<Pick<V2PersistedConnectorSlot, "type" | "side" | "offset" | "label">>
  ): V2PersistedConnectorSlot[] {
    const nextDraft = slotDraftRef.current.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              ...patch,
              ...(patch.offset !== undefined
                ? { offset: clampEditableSlotOffset(patch.offset) }
                : {}),
            }
          : slot
    );
    slotDraftRef.current = nextDraft;
    setSlotDraft(nextDraft);
    setSlotEditorError(null);
    return nextDraft;
  }

  async function persistConnectorSlots(nextDraft = slotDraftRef.current) {
    const validation = validateV2ConnectorSlots(nextDraft);
    if (!validation.ok) {
      setSlotEditorError(validation.message);
      return;
    }

    setSlotEditorError(null);
    try {
      await data.onUpdateVisualStyle?.(card.id, {
        connectorSlots: validation.slots,
      } as V2CardVisualStyle);
      setSlotDraft(validation.slots);
      slotDraftRef.current = validation.slots;
    } catch {
      setSlotEditorError("Could not save connector slots.");
    }
  }

  function addSlotAtPoint(clientX: number, clientY: number) {
    const rect = articleRef.current?.getBoundingClientRect();
    if (!rect) return;

    const position = getOutsidePerimeterSlotFromPoint(rect, clientX, clientY);
    if (!position) return;

    const existingIds = new Set(slotDraftRef.current.map((slot) => slot.id));
    const slotId = createConnectorSlotId(existingIds);
    const sideLength = getSlotSideLength(rect, position.side);
    const resolvedPosition = resolveFreeSlotPosition(
      slotDraftRef.current,
      slotId,
      position,
      sideLength
    );
    const slot = {
      id: slotId,
      type: "input" as const,
      side: resolvedPosition.side,
      offset: resolvedPosition.offset,
    };
    const nextDraft = [...slotDraftRef.current, slot];
    slotDraftRef.current = nextDraft;
    setSlotDraft(nextDraft);
    setTypeChooserSlotId(slot.id);
    void persistConnectorSlots(nextDraft);
  }

  function handleOuterPerimeterDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!data.isVisualEditing) return;
    event.preventDefault();
    event.stopPropagation();
    setTypeChooserSlotId(null);
    setSlotEditorError(null);
    addSlotAtPoint(event.clientX, event.clientY);
  }

  function deleteSlot(slot: V2ConnectorSlot) {
    if (connectedPortKeys.has(slot.portKey)) {
      setSlotEditorError("Cannot delete a connected slot.");
      return;
    }

    const nextDraft = slotDraftRef.current.filter((draft) => draft.id !== slot.id);
    slotDraftRef.current = nextDraft;
    setSlotDraft(nextDraft);
    setTypeChooserSlotId(null);
    void persistConnectorSlots(nextDraft);
  }

  function changeSlotType(slot: V2ConnectorSlot, type: V2ConnectorSlotType) {
    if (connectedPortKeys.has(slot.portKey)) {
      setSlotEditorError("Cannot change type of a connected slot.");
      return;
    }

    const nextDraft = updateSlotDraft(slot.id, { type });
    setTypeChooserSlotId(null);
    void persistConnectorSlots(nextDraft);
  }

  function handleSlotPointerDown(
    event: ReactPointerEvent,
    slot: V2ConnectorSlot
  ) {
    if (!data.isVisualEditing) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeChooserTimerRef.current !== null) {
      window.clearTimeout(typeChooserTimerRef.current);
      typeChooserTimerRef.current = null;
    }
    setTypeChooserSlotId(null);
    setSlotEditorError(null);
    lastSlotDragMovedRef.current = false;
    dragStartRef.current = {
      slotId: slot.id,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    setDraggingSlotId(slot.id);
    data.onConnectorSlotDragStart?.();
  }

  function handleSlotClick(event: ReactMouseEvent, slot: V2ConnectorSlot) {
    if (!data.isVisualEditing) return;
    event.preventDefault();
    event.stopPropagation();
    if (lastSlotDragMovedRef.current) {
      lastSlotDragMovedRef.current = false;
      return;
    }

    if (connectedPortKeys.has(slot.portKey)) {
      setTypeChooserSlotId(null);
      return;
    }

    setSlotEditorError(null);
    if (typeChooserTimerRef.current !== null) {
      window.clearTimeout(typeChooserTimerRef.current);
    }
    typeChooserTimerRef.current = window.setTimeout(() => {
      typeChooserTimerRef.current = null;
      setTypeChooserSlotId((current) => (current === slot.id ? null : slot.id));
    }, 180);
  }

  function handleSlotDoubleClick(event: ReactMouseEvent, slot: V2ConnectorSlot) {
    if (!data.isVisualEditing) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeChooserTimerRef.current !== null) {
      window.clearTimeout(typeChooserTimerRef.current);
      typeChooserTimerRef.current = null;
    }
    setTypeChooserSlotId(null);
    deleteSlot(slot);
  }

  function handleCardDoubleClick(event: ReactMouseEvent<HTMLElement>) {
    if (!data.isVisualEditing) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        ".v2CardHandle, .v2CardActionMenuWrap, .v2ConnectorSlotTypePopover"
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    if (!isMenuOpen) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof globalThis.Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isMenuOpen]);

  function runMenuAction(action: () => Promise<void> | void) {
    if (data.isCardActionPending) return;
    setIsMenuOpen(false);
    void Promise.resolve(action()).catch(() => {});
  }

  return (
    <article
      ref={articleRef}
      className="v2CardNode"
      onDoubleClick={handleCardDoubleClick}
      style={{
        display: "flex",
        flexDirection: "column",
        borderColor: cardBorderColor,
        boxShadow: selected
          ? "0 0 0 3px var(--v2-card-accent-soft), var(--v2-card-shadow)"
          : "var(--v2-card-shadow)",
        width: "100%",
        height: "100%",
        ["--v2-card-accent" as string]: accentColor,
        ["--v2-card-accent-soft" as string]: `var(--yd-accent-${accentKey}-soft)`,
        ["--v2-card-accent-surface" as string]: `var(--yd-accent-${accentKey}-surface)`,
        ["--v2-card-accent-text" as string]: `var(--yd-accent-${accentKey}-text)`,
        ["--v2-card-accent-border" as string]: `var(--yd-accent-${accentKey}-border)`,
      }}
    >
      {/* Resize handles in visual edit mode */}
      <NodeResizer
        isVisible={Boolean(data.isVisualEditing)}
        minWidth={V2_CARD_MIN_SIZE.width}
        minHeight={V2_CARD_MIN_SIZE.height}
        handleClassName="v2CardResizeHandle"
        lineClassName="v2CardResizeLine"
        handleStyle={{
          width: 10,
          height: 10,
          backgroundColor: "#000",
          border: "2px solid #fff",
          borderRadius: 1,
        }}
        lineStyle={{
          borderColor: "transparent",
          backgroundColor: "transparent",
        }}
        onResizeEnd={(_event, params) => {
          data.onResizeCard?.(card.id, {
            width: params.width,
            height: params.height,
          });
        }}
      />
      {data.isVisualEditing && slotEditorError ? (
        <p className="v2ConnectorSlotMessage nodrag">{slotEditorError}</p>
      ) : null}

      {data.isVisualEditing ? (
        <>
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <div
              key={side}
              className={`v2ConnectorSlotAddZone ${getSlotAddZoneSideClass(side)} nodrag nopan`}
              aria-hidden="true"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={handleOuterPerimeterDoubleClick}
            />
          ))}
        </>
      ) : null}

      {renderedConnectorSlots.flatMap((slot) => {
        const isConnected = connectedPortKeys.has(slot.portKey);
        return getHandleTypes(slot.type).map((handleType) => (
          <Handle
            key={`${slot.id}-${handleType}`}
            type={handleType}
            position={getHandlePosition(slot.side)}
            id={slot.id}
            onPointerDown={
              data.isVisualEditing
                ? (event) => handleSlotPointerDown(event, slot)
                : undefined
            }
            onClick={
              data.isVisualEditing
                ? (event) => handleSlotClick(event, slot)
                : undefined
            }
            onDoubleClick={
              data.isVisualEditing
                ? (event) => handleSlotDoubleClick(event, slot)
                : undefined
            }
            className={[
              "v2CardHandle",
              getSlotShapeClass(slot.type),
              getSlotSideClass(slot.side),
              isConnected ? "v2CardHandleConnected" : "v2CardHandleFree",
              data.isVisualEditing ? "v2ConnectorSlotEditable nodrag nopan" : "",
              data.isVisualEditing && isConnected ? "v2ConnectorSlotLocked" : "",
              draggingSlotId === slot.id ? "v2ConnectorSlotDragging" : "",
              slot.type === "receiver" && handleType === "source"
                ? "v2CardHandleReceiverSourceLayer"
                : "",
            ].join(" ")}
            style={getSlotPositionStyle(slot)}
            title={`${slot.label ?? slot.portKey} · ${isConnected ? "connected" : "free"}`}
          />
        ));
      })}

      {typeChooserSlot ? (
        <div
          className="v2ConnectorSlotTypePopover nodrag nopan"
          style={getSlotPopoverStyle(
            typeChooserSlot,
            articleRef.current?.getBoundingClientRect()
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {(["input", "output", "receiver"] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={`v2ConnectorSlotTypeButton${
                typeChooserSlot.type === type ? " v2ConnectorSlotTypeButtonActive" : ""
              }`}
              onClick={() => changeSlotType(typeChooserSlot, type)}
            >
              {type}
            </button>
          ))}
        </div>
      ) : null}

      {/* Compact header (fixed top) */}
      <div className="v2CardHeader">
        <span className="v2CardTypeIcon" aria-hidden="true">
          <CardTypeIcon size={17} strokeWidth={2.1} />
        </span>
        <span className="v2CardTypeLabel">{cardType.name}</span>
        <div
          ref={menuRef}
          className="v2CardActionMenuWrap nodrag"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="v2CardMenuButton"
            aria-label="Card actions"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen((current) => !current);
            }}
          >
            <MoreHorizontal size={18} strokeWidth={2.2} />
          </button>
          {isMenuOpen ? (
            <div className="v2CardActionMenu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(() => data.onStartVisualEditor?.(card.id))}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={data.isCardActionPending}
                onClick={() => runMenuAction(() => data.onDuplicateCard?.(card.id))}
              >
                {data.pendingCardAction === "duplicate" ? "Duplicating..." : "Duplicate"}
              </button>
              <button
                type="button"
                role="menuitem"
                className="v2CardActionMenuDanger"
                disabled={data.isCardActionPending}
                onClick={() => runMenuAction(() => data.onDeleteCard?.(card.id))}
              >
                {data.pendingCardAction === "delete" ? "Deleting..." : "Delete"}
              </button>
              {data.cardActionError ? (
                <p className="v2CardActionMenuError">{data.cardActionError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={bodyRef}
        className="v2CardBody"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent:
            dataPreviewRows.length > 0
              ? "flex-start"
              : bodyVerticalJustify(card.visualStyle?.bodyVerticalAlign),
          flex: 1,
          minHeight: 0,
        }}
      >
        <span
          ref={titleRef}
          className="v2CardTitle"
          style={textStyle}
        >
          {card.title}
        </span>
        <span
          ref={subtitleRef}
          className="v2CardSubtitle"
          style={textStyle}
        >
          {getCardSummary(card)}
        </span>
        {visibleDataPreviewRows.length > 0 ? (
          <dl className="v2CardDataPreview" aria-label="Card data preview">
            {visibleDataPreviewRows.map((row) => (
              <div
                key={row.key}
                className={`v2CardDataPreviewRow${
                  row.variant === "linkedSource"
                    ? " v2CardDataPreviewRowLinkedSource"
                    : row.variant === "linked"
                      ? " v2CardDataPreviewRowLinked"
                      : ""
                }`}
              >
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </article>
  );
}
