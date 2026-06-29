"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Database, MoreHorizontal } from "lucide-react";
import type { V2Card, V2CardType, V2CardTypePort } from "@yadraw/shared";
import type { Node } from "@xyflow/react";

export type V2CardNodeData = {
  card: V2Card;
  cardType: V2CardType;
  expanded?: boolean;
  onToggleExpanded?: (cardId: string) => void;
  isVisualEditing?: boolean;
  onResizeCard?: (cardId: string, size: { width: number; height: number }) => void;
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
          style={{
            fontFamily: card.visualStyle?.fontFamily,
            textAlign: card.visualStyle?.textAlign,
            color: card.visualStyle?.textColor,
          }}
        >
          {card.title}
        </span>
        {!data.expanded ? (
          <span
            className="v2CardSubtitle"
            style={{
              fontFamily: card.visualStyle?.fontFamily ?? undefined,
              textAlign: card.visualStyle?.textAlign ?? undefined,
            }}
          >
            {getCardSummary(card)}
          </span>
        ) : null}
        {/* Expanded content */}
        {data.expanded ? (
          <div
            className="v2CardExpandedContent"
            style={{
              fontFamily: card.visualStyle?.fontFamily ?? undefined,
              color: card.visualStyle?.textColor ?? undefined,
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
