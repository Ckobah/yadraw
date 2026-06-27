"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Edge,
} from "@xyflow/react";
import { useMemo } from "react";
import type {
  V2BoardDetail,
  V2Card,
  V2Connection,
  V2CardType,
} from "@yadraw/shared";
import { V2CardNodeComponent, type V2CardNode } from "./v2-card-node";

type Props = {
  boardDetail: V2BoardDetail;
};

function buildCardTypeMap(
  cardTypes: V2CardType[]
): Map<string, V2CardType> {
  const map = new Map<string, V2CardType>();
  for (const ct of cardTypes) {
    map.set(ct.id, ct);
  }
  return map;
}

export function V2BoardCanvas({ boardDetail }: Props) {
  const { board, cards, connections, cardTypes } = boardDetail;
  const cardTypeMap = useMemo(() => buildCardTypeMap(cardTypes), [cardTypes]);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: V2CardNode[] = cards.map((card: V2Card) => {
      const cardType = cardTypeMap.get(card.cardTypeId);
      return {
        id: card.id,
        type: "v2Card",
        position: { x: card.position.x, y: card.position.y },
        data: {
          card,
          cardType: cardType ?? {
            id: card.cardTypeId,
            workspaceId: board.workspaceId,
            key: "unknown",
            name: "Unknown",
            description: "",
            defaultData: {},
            defaultSize: { width: 200, height: 120 },
            ports: [],
            createdAt: "",
            updatedAt: "",
          },
        },
      };
    });

    const edges: Edge[] = connections.map((conn: V2Connection) => ({
      id: conn.id,
      source: conn.sourceCardId,
      target: conn.targetCardId,
      sourceHandle: conn.sourcePortKey,
      targetHandle: conn.targetPortKey,
      label: conn.label || undefined,
      type: "smoothstep",
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
      },
      style: {
        stroke: "var(--line-strong)",
        strokeWidth: 1.5,
      },
      labelStyle: {
        fontSize: 11,
        fill: "var(--muted)",
        fontWeight: 500,
      },
    }));

    return { nodes, edges };
  }, [cards, connections, cardTypeMap, board.workspaceId]);

  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edgeList, _setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodeTypes = useMemo(
    () => ({ v2Card: V2CardNodeComponent }),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edgeList}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag={true}
      zoomOnScroll={true}
    >
      <Background color="var(--line)" gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        style={{
          border: "1px solid var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
        nodeColor={() => "#7147e8"}
        maskColor="rgba(0,0,0,0.08)"
      />
    </ReactFlow>
  );
}
