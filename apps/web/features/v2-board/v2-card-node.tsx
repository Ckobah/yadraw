"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import type { V2Card, V2CardType, V2CardTypePort } from "@yadraw/shared";
import type { Node } from "@xyflow/react";

export type V2CardNodeData = {
  card: V2Card;
  cardType: V2CardType;
};

export type V2CardNode = Node<V2CardNodeData, "v2Card">;

function getInputPort(ports: V2CardTypePort[]): V2CardTypePort | undefined {
  return ports.find((p) => p.direction === "input");
}

function getOutputPort(ports: V2CardTypePort[]): V2CardTypePort | undefined {
  return ports.find((p) => p.direction === "output");
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

export function V2CardNodeComponent({ data, selected }: NodeProps<V2CardNode>) {
  const { card, cardType } = data;
  const accentColor = accentColorByType[cardType.key] ?? "var(--blue)";
  const inputPort = getInputPort(cardType.ports);
  const outputPort = getOutputPort(cardType.ports);

  return (
    <article
      className="v2CardNode"
      style={{
        borderColor: selected ? accentColor : "var(--line)",
        boxShadow: selected
          ? `0 0 0 2px ${accentColor}33, var(--shadow)`
          : "var(--shadow)",
        width: card.size.width,
      }}
    >
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

      {/* Compact header */}
      <div className="v2CardHeader">
        <span
          className="v2CardTypeBadge"
          style={{ backgroundColor: accentColor }}
        >
          {cardType.key}
        </span>
        <span className="v2CardTitle">{card.title}</span>
      </div>

      {/* Port labels row — compact */}
      <div className="v2CardPortRow">
        {inputPort && (
          <span className="v2CardPortLabel v2CardPortLabelInput">
            {inputPort.label}
          </span>
        )}
        {outputPort && (
          <span className="v2CardPortLabel v2CardPortLabelOutput">
            {outputPort.label}
          </span>
        )}
      </div>

      {/* Expand arrow — no behavior yet */}
      <button
        className="v2CardExpandButton"
        type="button"
        aria-label="Expand card details"
        tabIndex={-1}
      >
        <ChevronDown size={14} />
      </button>
    </article>
  );
}
