"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
  buildV2ConnectorSlotsFromPorts,
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
};

export type V2CardNode = Node<V2CardNodeData, "v2Card">;

export const V2_CARD_MIN_SIZE = {
  width: 196,
  height: 122,
} as const;

function getHandleType(slotType: V2ConnectorSlotType): "source" | "target" {
  return slotType === "output" ? "source" : "target";
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

function getSlotPositionStyle(slot: V2ConnectorSlot): CSSProperties {
  const offset = `${slot.offset * 100}%`;
  if (slot.side === "top" || slot.side === "bottom") {
    return { left: offset };
  }
  return { top: offset };
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
  const menuRef = useRef<HTMLDivElement>(null);
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
  const [isSlotEditorSaving, setIsSlotEditorSaving] = useState(false);
  const renderedConnectorSlots =
    data.isVisualEditing && slotDraft.length > 0
      ? slotDraft.map(toRuntimeV2ConnectorSlot)
      : connectorSlots;
  const connectedPortKeys = new Set(data.connectedPortKeys ?? []);
  const textStyle = {
    fontFamily: visualStyle.fontFamily,
    textAlign: visualStyle.textAlign,
    color: visualStyle.textColor,
    fontWeight: visualStyle.fontWeight,
    fontStyle: visualStyle.fontStyle,
    textDecoration: visualStyle.textDecoration,
  };

  function updateVisualStyle(patch: V2CardVisualStyle) {
    void Promise.resolve(data.onUpdateVisualStyle?.(card.id, patch)).catch(() => {});
  }

  useEffect(() => {
    if (!data.isVisualEditing) return;
    setSlotDraft(connectorSlots.map(toPersistedV2ConnectorSlot));
    setSlotEditorError(null);
  }, [card.id, connectorSlotSourceKey, data.isVisualEditing]);

  function updateSlotDraft(
    slotId: string,
    patch: Partial<Pick<V2PersistedConnectorSlot, "side" | "offset" | "label">>
  ) {
    setSlotDraft((current) =>
      current.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              ...patch,
              ...(patch.offset !== undefined
                ? { offset: clampEditableSlotOffset(patch.offset) }
                : {}),
            }
          : slot
      )
    );
    setSlotEditorError(null);
  }

  async function saveConnectorSlots(nextDraft = slotDraft) {
    const validation = validateV2ConnectorSlots(nextDraft);
    if (!validation.ok) {
      setSlotEditorError(validation.message);
      return;
    }

    setIsSlotEditorSaving(true);
    setSlotEditorError(null);
    try {
      await data.onUpdateVisualStyle?.(card.id, {
        ...visualStyle,
        connectorSlots: validation.slots,
      } as V2CardVisualStyle);
      setSlotDraft(validation.slots);
    } catch {
      setSlotEditorError("Could not save connector slots.");
    } finally {
      setIsSlotEditorSaving(false);
    }
  }

  async function resetConnectorSlotsToFallback() {
    const fallbackSlots = buildV2ConnectorSlotsFromPorts(cardType.ports).map(
      toPersistedV2ConnectorSlot
    );
    setSlotDraft(fallbackSlots);
    setSlotEditorError(null);
    setIsSlotEditorSaving(true);
    try {
      await data.onUpdateVisualStyle?.(card.id, {
        ...visualStyle,
        connectorSlots: undefined,
      } as V2CardVisualStyle);
    } catch {
      setSlotEditorError("Could not reset connector slots.");
    } finally {
      setIsSlotEditorSaving(false);
    }
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
      className="v2CardNode"
      style={{
        display: "flex",
        flexDirection: "column",
        borderColor: selected ? accentColor : "var(--line)",
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
        handleStyle={{
          width: 10,
          height: 10,
          backgroundColor: "#000",
          border: "2px solid #fff",
          borderRadius: 1,
        }}
        lineStyle={{
          borderColor: "#000",
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
            className="v2CardTextToolbar nodrag"
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

          <section
            className="v2ConnectorSlotEditor nodrag"
            aria-label="Connector slots"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <div className="v2ConnectorSlotEditorHeader">
              <div>
                <strong>Connector slots</strong>
                <span>{slotDraft.length} slots</span>
              </div>
              <div className="v2ConnectorSlotActions">
                <button
                  type="button"
                  className="v2ConnectorSlotReset"
                  disabled={isSlotEditorSaving}
                  onClick={() => void resetConnectorSlotsToFallback()}
                >
                  Reset to fallback
                </button>
                <button
                  type="button"
                  className="v2ConnectorSlotSave"
                  disabled={isSlotEditorSaving}
                  onClick={() => void saveConnectorSlots()}
                >
                  {isSlotEditorSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="v2ConnectorSlotList">
              {slotDraft.map((slot) => (
                <div className="v2ConnectorSlotRow" key={slot.id}>
                  <div className="v2ConnectorSlotMeta">
                    <span className="v2ConnectorSlotName">{slot.label || slot.id}</span>
                    <span className="v2ConnectorSlotId">{slot.id}</span>
                  </div>
                  <div className="v2ConnectorSlotControls">
                    <label>
                      <span>Type</span>
                      <input value={slot.type} readOnly />
                    </label>
                    <label>
                      <span>Side</span>
                      <select
                        value={slot.side}
                        onChange={(event) =>
                          updateSlotDraft(slot.id, {
                            side: event.target.value as V2ConnectorSlotSide,
                          })
                        }
                      >
                        <option value="top">top</option>
                        <option value="right">right</option>
                        <option value="bottom">bottom</option>
                        <option value="left">left</option>
                      </select>
                    </label>
                    <label className="v2ConnectorSlotOffset">
                      <span>Offset</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={slot.offset}
                        onChange={(event) =>
                          updateSlotDraft(slot.id, {
                            offset: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="v2ConnectorSlotOffsetNumber">
                      <span>Value</span>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={slot.offset}
                        onChange={(event) =>
                          updateSlotDraft(slot.id, {
                            offset: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="v2ConnectorSlotLabel">
                      <span>Label</span>
                      <input
                        value={slot.label ?? ""}
                        onChange={(event) =>
                          updateSlotDraft(slot.id, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {slotEditorError ? (
              <p className="v2ConnectorSlotError">{slotEditorError}</p>
            ) : null}
          </section>
        </>
      ) : null}

      {renderedConnectorSlots.map((slot) => {
        const isConnected = connectedPortKeys.has(slot.portKey);
        return (
          <Handle
            key={slot.id}
            type={getHandleType(slot.type)}
            position={getHandlePosition(slot.side)}
            id={slot.id}
            className={[
              "v2CardHandle",
              getSlotShapeClass(slot.type),
              getSlotSideClass(slot.side),
              isConnected ? "v2CardHandleConnected" : "v2CardHandleFree",
            ].join(" ")}
            style={getSlotPositionStyle(slot)}
            title={`${slot.label ?? slot.portKey} · ${isConnected ? "connected" : "free"}`}
          />
        );
      })}

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
