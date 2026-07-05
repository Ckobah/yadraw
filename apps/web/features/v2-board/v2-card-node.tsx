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
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsUpDown,
  Database,
  Italic,
  MoreHorizontal,
  Underline,
  X,
} from "lucide-react";
import type { V2Card, V2CardType, V2CardVisualStyle } from "@yadraw/shared";
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

export type V2CardNodeData = {
  card: V2Card;
  cardType: V2CardType;
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
  width: 196,
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

const accentColorByType: Record<string, string> = {
  source: "var(--green)",
  task: "var(--blue)",
  trigger: "var(--green)",
  ai_action: "var(--blue)",
  database: "var(--purple)",
  vector_store: "var(--teal)",
  storage: "var(--pink)",
  note: "var(--blue)",
};

export function getV2CardAccentColor(cardTypeKey?: string): string {
  return cardTypeKey ? accentColorByType[cardTypeKey] ?? "var(--blue)" : "var(--blue)";
}

function getCardSummary(card: V2Card): string {
  if (card.description.trim()) return card.description.trim();
  const kind = card.data.kind;
  return typeof kind === "string" && kind.trim() ? kind.trim() : "No description";
}

export function V2CardNodeComponent({ data, selected }: NodeProps<V2CardNode>) {
  const { card, cardType } = data;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const accentColor = getV2CardAccentColor(cardType.key);
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
  const hasTopConnectorSlot = renderedConnectorSlots.some((slot) => slot.side === "top");
  const textStyle = {
    fontFamily: visualStyle.fontFamily,
    textAlign: visualStyle.textAlign,
    color: visualStyle.textColor,
    fontWeight: visualStyle.fontWeight,
    fontStyle: visualStyle.fontStyle,
    textDecoration: visualStyle.textDecoration,
  };
  const cardBorderColor = selected
    ? accentColor
    : visualStyle.borderColor ?? "var(--line)";

  function updateVisualStyle(patch: V2CardVisualStyle) {
    void Promise.resolve(data.onUpdateVisualStyle?.(card.id, patch)).catch(() => {});
  }

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
        ".v2CardHandle, .v2CardTextToolbar, .v2CardActionMenuWrap, .v2ConnectorSlotTypePopover"
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
        backgroundColor: visualStyle.fillColor,
        boxShadow: selected
          ? `0 0 0 3px ${accentColor}22, var(--v2-card-shadow)`
          : "var(--v2-card-shadow)",
        width: "100%",
        height: "100%",
        ["--v2-card-accent" as string]: accentColor,
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
      {data.isVisualEditing ? (
        <>
          <div
            className={`v2CardTextToolbar nodrag${
              hasTopConnectorSlot ? " v2CardTextToolbarClearTopSlots" : ""
            }`}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
          <div className="v2ToolbarGroup v2ToolbarGroupAlign" aria-label="Alignment">
            <span className="v2ToolbarLabel">Alignment</span>
            <div className="v2ToolbarButtonRow">
              {[
                { value: "left" as const, icon: AlignLeft, label: "Left" },
                { value: "center" as const, icon: AlignCenter, label: "Center" },
                { value: "right" as const, icon: AlignRight, label: "Right" },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = (visualStyle.textAlign ?? "left") === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`v2ToolbarIconButton${isActive ? " v2ToolbarIconButtonActive" : ""}`}
                    title={item.label}
                    onClick={() => updateVisualStyle({ textAlign: item.value })}
                  >
                    <Icon size={14} strokeWidth={2.2} />
                  </button>
                );
              })}
              <button
                type="button"
                className={`v2ToolbarIconButton${visualStyle.bodyVerticalAlign === "center" ? " v2ToolbarIconButtonActive" : ""}`}
                title="Vertical center"
                onClick={() =>
                  updateVisualStyle({
                    bodyVerticalAlign: visualStyle.bodyVerticalAlign === "center" ? "top" : "center",
                  })
                }
              >
                <ChevronsUpDown size={14} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          <div className="v2ToolbarGroup" aria-label="Font">
            <span className="v2ToolbarLabel">Font</span>
            <select
              className="v2ToolbarSelect"
              value={visualStyle.fontFamily ?? ""}
              onChange={(event) => updateVisualStyle({ fontFamily: event.target.value || undefined })}
            >
              <option value="">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
              <option value="monospace">Mono</option>
            </select>
          </div>

          <div className="v2ToolbarGroup v2ToolbarGroupInline" aria-label="Text style">
            <button
              type="button"
              className={`v2ToolbarIconButton${visualStyle.fontWeight === "700" ? " v2ToolbarIconButtonActive" : ""}`}
              title="Bold"
              onClick={() => updateVisualStyle({ fontWeight: visualStyle.fontWeight === "700" ? undefined : "700" })}
            >
              <Bold size={14} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className={`v2ToolbarIconButton${visualStyle.fontStyle === "italic" ? " v2ToolbarIconButtonActive" : ""}`}
              title="Italic"
              onClick={() => updateVisualStyle({ fontStyle: visualStyle.fontStyle === "italic" ? undefined : "italic" })}
            >
              <Italic size={14} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className={`v2ToolbarIconButton${visualStyle.textDecoration === "underline" ? " v2ToolbarIconButtonActive" : ""}`}
              title="Underline"
              onClick={() =>
                updateVisualStyle({
                  textDecoration: visualStyle.textDecoration === "underline" ? undefined : "underline",
                })
              }
            >
              <Underline size={14} strokeWidth={2.4} />
            </button>
          </div>

          <div className="v2ToolbarGroup" aria-label="Text color">
            <span className="v2ToolbarLabel">Text Color</span>
            <input
              className="v2ToolbarColor"
              type="color"
              value={visualStyle.textColor ?? "#101828"}
              title="Text color"
              onChange={(event) => updateVisualStyle({ textColor: event.target.value })}
            />
          </div>

            <button
              type="button"
              className="v2ToolbarCloseButton"
              aria-label="Close text editor"
              onClick={() => data.onCloseVisualEditor?.()}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>

          {slotEditorError ? (
            <p className="v2ConnectorSlotMessage nodrag">{slotEditorError}</p>
          ) : null}
        </>
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
          <Database size={17} strokeWidth={2.1} />
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
        className="v2CardBody"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: bodyVerticalJustify(card.visualStyle?.bodyVerticalAlign),
          flex: 1,
          minHeight: 0,
        }}
      >
        <span
          className="v2CardTitle"
          style={textStyle}
        >
          {card.title}
        </span>
        <span
          className="v2CardSubtitle"
          style={textStyle}
        >
          {getCardSummary(card)}
        </span>
      </div>
    </article>
  );
}
