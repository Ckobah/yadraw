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
  type Connection,
} from "@xyflow/react";
import { useMemo, useCallback, useEffect, useState } from "react";
import type {
  V2BoardDetail,
  V2Card,
  V2Connection,
  V2CardType,
  V2CardVisualStyle,
} from "@yadraw/shared";
import { V2CardNodeComponent, type V2CardNode } from "./v2-card-node";
import {
  updateV2CardPosition,
  updateV2CardSize,
  updateV2CardVisualStyle,
  createV2Connection,
  deleteV2Connection,
} from "./api";

type Props = {
  boardDetail: V2BoardDetail;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function buildCardTypeMap(
  cardTypes: V2CardType[]
): Map<string, V2CardType> {
  const map = new Map<string, V2CardType>();
  for (const ct of cardTypes) {
    map.set(ct.id, ct);
  }
  return map;
}

/** Check if a handle is valid for a given port direction */
function isValidHandle(
  cardType: V2CardType | undefined,
  handleId: string,
  direction: "input" | "output"
): boolean {
  if (!cardType) return false;
  return cardType.ports.some(
    (p) => p.key === handleId && p.direction === direction
  );
}

export function V2BoardCanvas({ boardDetail }: Props) {
  const { board, cards, connections, cardTypes } = boardDetail;
  const cardTypeMap = useMemo(() => buildCardTypeMap(cardTypes), [cardTypes]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(
    () => new Set()
  );

  const toggleCardExpanded = useCallback((cardId: string) => {
    setExpandedCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }, []);

  // ── Visual edit mode (state only — handlers below useNodesState) ──
  const [visualEditingCardId, setVisualEditingCardId] = useState<string | null>(null);

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
        style: {
          width: card.size.width,
          height: card.size.height,
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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const nodeTypes = useMemo(
    () => ({ v2Card: V2CardNodeComponent }),
    []
  );

  // ── Visual edit handlers ─────────────────────────────────────────
  const handleResizeCard = useCallback(
    async (cardId: string, size: { width: number; height: number }) => {
      // Optimistic local update
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== cardId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              card: { ...node.data.card, size },
            },
            style: {
              ...node.style,
              width: size.width,
              height: size.height,
            },
          };
        })
      );

      setSaveStatus("saving");
      try {
        await updateV2CardSize(cardId, size);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save card size:", err);
        setSaveStatus("error");
      }
    },
    [setNodes]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: unknown, node: V2CardNode) => {
      setVisualEditingCardId((current) =>
        current === node.id ? null : node.id
      );
    },
    []
  );

  const handleUpdateVisualStyle = useCallback(
    async (
      cardId: string,
      patch: {
        fontFamily?: string;
        textAlign?: "left" | "center" | "right";
        textColor?: string;
        fontWeight?: "400" | "600" | "700";
        fontStyle?: "normal" | "italic";
        textDecoration?: "none" | "underline";
        bodyVerticalAlign?: "top" | "center" | "bottom";
      }
    ) => {
      // Find current visualStyle from nodes state
      const node = nodes.find((n) => n.id === cardId);
      const current = (node?.data as { card?: { visualStyle?: V2CardVisualStyle } })?.card?.visualStyle ?? {};
      const nextVisualStyle = Object.fromEntries(
        Object.entries({ ...current, ...patch }).filter(([, value]) => value !== undefined && value !== "")
      ) as V2CardVisualStyle;

      // Optimistic local update
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== cardId) return n;
          return {
            ...n,
            data: {
              ...n.data,
              card: { ...n.data.card, visualStyle: nextVisualStyle },
            },
          };
        })
      );

      setSaveStatus("saving");
      try {
        await updateV2CardVisualStyle(cardId, nextVisualStyle);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save visual style:", err);
        setSaveStatus("error");
      }
    },
    [nodes, setNodes]
  );

  // ── Sync dynamic state into node data ────────────────────────────
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          expanded: expandedCardIds.has(node.id),
          onToggleExpanded: toggleCardExpanded,
          isVisualEditing: visualEditingCardId === node.id,
          onResizeCard: handleResizeCard,
          onUpdateVisualStyle: handleUpdateVisualStyle,
          onCloseVisualEditor: () => setVisualEditingCardId(null),
        },
      }))
    );
  }, [
    expandedCardIds,
    setNodes,
    toggleCardExpanded,
    visualEditingCardId,
    handleResizeCard,
    handleUpdateVisualStyle,
  ]);

  // ── Drag save ────────────────────────────────────────────────────
  const handleNodeDragStop = useCallback(
    (_event: unknown, node: V2CardNode) => {
      setSaveStatus("saving");
      updateV2CardPosition(node.id, node.position)
        .then(() => setSaveStatus("saved"))
        .catch((err) => {
          console.error("Failed to save card position:", err);
          setSaveStatus("error");
        });
    },
    []
  );

  // ── Create connection ────────────────────────────────────────────
  const handleConnect = useCallback(
    async (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target || !sourceHandle || !targetHandle) return;

      // Basic client-side validation via card types
      const sourceType = cardTypeMap.get(
        cards.find((c) => c.id === source)?.cardTypeId ?? ""
      );
      const targetType = cardTypeMap.get(
        cards.find((c) => c.id === target)?.cardTypeId ?? ""
      );
      if (
        !isValidHandle(sourceType, sourceHandle, "output") ||
        !isValidHandle(targetType, targetHandle, "input")
      ) {
        console.error(
          "Invalid connection: source handle must be output, target handle must be input"
        );
        return;
      }

      setSaveStatus("saving");
      try {
        const created = await createV2Connection(
          board.id,
          {
            sourceCardId: source,
            targetCardId: target,
            sourcePortKey: sourceHandle,
            targetPortKey: targetHandle,
            type: "data",
            label: sourceHandle,
          }
        );

        // Add the new edge from the API response
        const newEdge: Edge = {
          id: created.id,
          source: created.sourceCardId,
          target: created.targetCardId,
          sourceHandle: created.sourcePortKey,
          targetHandle: created.targetPortKey,
          label: created.label || undefined,
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
        };
        setEdges((prev) => [...prev, newEdge]);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to create connection:", err);
        setSaveStatus("error");
      }
    },
    [board.id, cardTypeMap, cards, setEdges]
  );

  // ── Delete connection ────────────────────────────────────────────
  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        deleteV2Connection(edge.id).catch((err) =>
          console.error("Failed to delete connection:", err)
        );
      }
    },
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={handleNodeDragStop}
      onNodeDoubleClick={handleNodeDoubleClick}
      onConnect={handleConnect}
      onEdgesDelete={handleEdgesDelete}
      onPaneClick={() => setVisualEditingCardId(null)}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={true}
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
