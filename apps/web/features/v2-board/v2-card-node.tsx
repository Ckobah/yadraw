"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
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
import type { V2Card, V2CardType, V2CardTypePort, V2CardVisualStyle } from "@yadraw/shared";
import type { Node } from "@xyflow/react";

export type V2CardNodeData = {
  card: V2Card;
  cardType: V2CardType;
  expanded?: boolean;
  onToggleExpanded?: (cardId: string) => void;
  isVisualEditing?: boolean;
  onResizeCard?: (cardId: string, size: { width: number; height: number }) => void;
  onUpdateVisualStyle?: (cardId: string, patch: V2CardVisualStyle) => void;
  onCloseVisualEditor?: () => void;
};

export type V2CardNode = Node<V2CardNodeData, "v2Card">;

function getInputPort(ports: V2CardTypePort[]): V2CardTypePort | undefined {
  return ports.find((p) => p.direction === "input");
}

function getOutputPort(ports: V2CardTypePort[]): V2CardTypePort | undefined {
  return ports.find((p) => p.direction === "output");
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

function getCardSummary(card: V2Card): string {
  if (card.description.trim()) return card.description.trim();
  const kind = card.data.kind;
  return typeof kind === "string" && kind.trim() ? kind.trim() : "No description";
}

export function V2CardNodeComponent({ data, selected }: NodeProps<V2CardNode>) {
  const { card, cardType } = data;
  const accentColor = accentColorByType[cardType.key] ?? "var(--blue)";
  const inputPort = getInputPort(cardType.ports);
  const outputPort = getOutputPort(cardType.ports);
  const visualStyle = card.visualStyle ?? {};
  const textStyle = {
    fontFamily: visualStyle.fontFamily,
    textAlign: visualStyle.textAlign,
    color: visualStyle.textColor,
    fontWeight: visualStyle.fontWeight,
    fontStyle: visualStyle.fontStyle,
    textDecoration: visualStyle.textDecoration,
  };

  function updateVisualStyle(patch: V2CardVisualStyle) {
    data.onUpdateVisualStyle?.(card.id, patch);
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
        minWidth={160}
        minHeight={104}
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
      ) : null}

      {/* Input handle — only if card type has an input port */}
      {inputPort && (
        <Handle
          type="target"
          position={Position.Left}
          id={inputPort.key}
          className="v2CardHandle v2CardHandleInput"
          title={inputPort.label}
        />
      )}

      {/* Output handle — only if card type has an output port */}
      {outputPort && (
        <Handle
          type="source"
          position={Position.Right}
          id={outputPort.key}
          className="v2CardHandle v2CardHandleOutput"
          title={outputPort.label}
        />
      )}

      {/* Compact header (fixed top) */}
      <div className="v2CardHeader">
        <span className="v2CardTypeIcon" aria-hidden="true">
          <Database size={17} strokeWidth={2.1} />
        </span>
        <span className="v2CardTypeLabel">{cardType.name}</span>
        <button
          type="button"
          className="v2CardMenuButton nodrag"
          aria-label={data.expanded ? "Collapse card details" : "Expand card details"}
          aria-expanded={data.expanded ?? false}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleExpanded?.(card.id);
          }}
        >
          <MoreHorizontal size={18} strokeWidth={2.2} />
        </button>
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
        {!data.expanded ? (
          <span
            className="v2CardSubtitle"
            style={textStyle}
          >
            {getCardSummary(card)}
          </span>
        ) : null}
        {/* Expanded content */}
        {data.expanded ? (
          <div
            className="v2CardExpandedContent"
            style={{
              ...textStyle,
            }}
          >
            <p className="v2CardDescription">
              {card.description || "No description"}
            </p>
            <pre className="v2CardDataPreview">
              {JSON.stringify(card.data, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </article>
  );
}
