"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Bot,
  Box,
  Database,
  FileText,
  MoreVertical,
  RadioTower,
  Sparkles
} from "lucide-react";
import type { Card } from "@yadraw/shared";

export type WorkflowNodeData = {
  card: Card;
};

export type WorkflowNode = Node<WorkflowNodeData, "workflowCard">;

const accentClassByName: Record<string, string> = {
  green: "nodeAccentGreen",
  blue: "nodeAccentBlue",
  purple: "nodeAccentPurple",
  orange: "nodeAccentOrange",
  teal: "nodeAccentTeal",
  pink: "nodeAccentPink"
};

function NodeIcon({ typeKey }: { typeKey: string }) {
  if (typeKey === "trigger") return <RadioTower size={24} />;
  if (typeKey === "database") return <Database size={24} />;
  if (typeKey === "vector_store") return <Box size={24} />;
  if (typeKey === "storage") return <FileText size={24} />;
  if (typeKey === "ai_action") return <Sparkles size={24} />;
  return <Bot size={24} />;
}

export function WorkflowCardNode({ data, selected }: NodeProps<WorkflowNode>) {
  const { card } = data;
  const accent = String(card.style.accent ?? "blue");
  const accentClass = accentClassByName[accent] ?? accentClassByName.blue;

  return (
    <article className={`workflowNode ${accentClass} ${selected ? "workflowNodeSelected" : ""}`}>
      <Handle className="nodeHandle nodeHandleInput" type="target" position={Position.Left} />
      <Handle className="nodeHandle nodeHandleOutput" type="source" position={Position.Right} />

      <header className="workflowNodeHeader">
        <div className="nodeIcon">
          <NodeIcon typeKey={card.typeKey} />
        </div>
        <div className="nodeTitleWrap">
          <h3>{card.title}</h3>
          <span>{card.typeKey}</span>
        </div>
        <button className="iconButton" type="button" aria-label="Node menu">
          <MoreVertical size={18} />
        </button>
      </header>

      <div className="nodePorts">
        {card.inputs.map((input) => (
          <div className="nodePort" key={`in-${input}`}>
            <span className="portDot" />
            <span>{input}</span>
          </div>
        ))}
        {card.outputs.map((output) => (
          <div className="nodePort" key={`out-${output}`}>
            <span className="portDot portDotOutput" />
            <span>{output}</span>
          </div>
        ))}
      </div>

      <footer className="workflowNodeFooter">
        <span>
          <FileText size={15} />
          {card.files[0]?.filename ?? `${card.files.length || Number(card.data.fileCount ?? 0)} files`}
        </span>
      </footer>
    </article>
  );
}
