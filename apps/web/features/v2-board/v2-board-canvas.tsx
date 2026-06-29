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
import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import type {
  V2BoardDetail,
  V2Card,
  V2Connection,
  V2CardType,
  V2CardVisualStyle,
} from "@yadraw/shared";
import {
  V2_CARD_MIN_SIZE,
  V2CardNodeComponent,
  type V2CardNode,
} from "./v2-card-node";
import { V2CardInspector } from "./v2-card-inspector";
import {
  createV2Card,
  updateV2CardPosition,
  updateV2CardSize,
  updateV2CardVisualStyle,
  updateV2CardBasics,
  createV2Connection,
  deleteV2Connection,
  deleteV2Card,
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

function clampCardSize(size: V2Card["size"]): V2Card["size"] {
  return {
    width: Math.max(size.width, V2_CARD_MIN_SIZE.width),
    height: Math.max(size.height, V2_CARD_MIN_SIZE.height),
  };
}

function fallbackCardType(card: V2Card, workspaceId: string): V2CardType {
  return {
    id: card.cardTypeId,
    workspaceId,
    key: "unknown",
    name: "Unknown",
    description: "",
    defaultData: {},
    defaultSize: { width: 200, height: 120 },
    ports: [],
    createdAt: "",
    updatedAt: "",
  };
}

function buildCardNode(
  card: V2Card,
  cardTypeMap: Map<string, V2CardType>,
  workspaceId: string
): V2CardNode {
  const size = clampCardSize(card.size);

  return {
    id: card.id,
    type: "v2Card",
    position: { x: card.position.x, y: card.position.y },
    data: {
      card: {
        ...card,
        size,
      },
      cardType: cardTypeMap.get(card.cardTypeId) ?? fallbackCardType(card, workspaceId),
    },
    style: {
      width: size.width,
      height: size.height,
    },
  };
}

export function V2BoardCanvas({ boardDetail }: Props) {
  const { board, cards, connections, cardTypes } = boardDetail;
  const cardTypeMap = useMemo(() => buildCardTypeMap(cardTypes), [cardTypes]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // ── Visual edit mode (state only — handlers below useNodesState) ──
  const [visualEditingCardId, setVisualEditingCardId] = useState<string | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: V2CardNode[] = cards.map((card: V2Card) =>
      buildCardNode(card, cardTypeMap, board.workspaceId)
    );

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
  const [connectionRecords, setConnectionRecords] = useState<V2Connection[]>(connections);
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const nodeTypes = useMemo(
    () => ({ v2Card: V2CardNodeComponent }),
    []
  );

  const cardById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.card])),
    [nodes]
  );
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedCardId) ?? null,
    [nodes, selectedCardId]
  );
  const selectedCard = selectedNode?.data.card ?? null;
  const selectedCardType = selectedNode?.data.cardType ?? (
    selectedCard ? cardTypeMap.get(selectedCard.cardTypeId) ?? null : null
  );
  const incomingConnections = useMemo(
    () =>
      selectedCard
        ? connectionRecords.filter((connection) => connection.targetCardId === selectedCard.id)
        : [],
    [connectionRecords, selectedCard]
  );
  const outgoingConnections = useMemo(
    () =>
      selectedCard
        ? connectionRecords.filter((connection) => connection.sourceCardId === selectedCard.id)
        : [],
    [connectionRecords, selectedCard]
  );

  // ── Visual edit handlers ─────────────────────────────────────────
  const handleResizeCard = useCallback(
    async (cardId: string, size: { width: number; height: number }) => {
      const nextSize = clampCardSize(size);

      // Optimistic local update
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== cardId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              card: { ...node.data.card, size: nextSize },
            },
            style: {
              ...node.style,
              width: nextSize.width,
              height: nextSize.height,
            },
          };
        })
      );

      setSaveStatus("saving");
      try {
        await updateV2CardSize(cardId, nextSize);
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
      setSelectedCardId(node.id);
      setVisualEditingCardId((current) =>
        current === node.id ? null : node.id
      );
    },
    []
  );

  const handleNodeClick = useCallback(
    (_event: unknown, node: V2CardNode) => {
      setSelectedCardId(node.id);
    },
    []
  );

  const handleUpdateVisualStyle = useCallback(
    async (
      cardId: string,
      patch: V2CardVisualStyle
    ) => {
      const node = nodesRef.current.find((n) => n.id === cardId);
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
    [setNodes]
  );

  const handleUpdateCardBasics = useCallback(
    async (
      cardId: string,
      input: { title?: string; description?: string | null }
    ) => {
      const patch: { title?: string; description?: string } = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description ?? "";
      if (patch.title === undefined && patch.description === undefined) return;

      const previous = nodesRef.current.find((node) => node.id === cardId)?.data.card;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== cardId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              card: {
                ...node.data.card,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
              },
            },
          };
        })
      );

      setSaveStatus("saving");
      try {
        await updateV2CardBasics(cardId, patch);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save card basics:", err);
        if (previous) {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id !== cardId) return node;
              return {
                ...node,
                data: {
                  ...node.data,
                  card: {
                    ...node.data.card,
                    title: previous.title,
                    description: previous.description,
                  },
                },
              };
            })
          );
        }
        setSaveStatus("error");
        throw err;
      }
    },
    [setNodes]
  );

  const handleStartVisualEditor = useCallback((cardId: string) => {
    setVisualEditingCardId(cardId);
  }, []);

  const handleDuplicateCard = useCallback(
    async (cardId: string) => {
      const sourceNode = nodesRef.current.find((node) => node.id === cardId);
      if (!sourceNode) return;

      const sourceCard = sourceNode.data.card;
      const nextPosition = {
        x: sourceNode.position.x + 32,
        y: sourceNode.position.y + 32,
      };

      setSaveStatus("saving");
      try {
        const created = await createV2Card(board.id, {
          cardTypeId: sourceCard.cardTypeId,
          title: `${sourceCard.title} Copy`,
          description: sourceCard.description,
          data: sourceCard.data,
          position: nextPosition,
          size: clampCardSize(sourceCard.size),
          visualStyle: sourceCard.visualStyle ?? {},
          status: sourceCard.status,
        });

        setNodes((current) => [
          ...current,
          buildCardNode(created, cardTypeMap, board.workspaceId),
        ]);
        setSelectedCardId(created.id);
        setVisualEditingCardId(created.id);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to duplicate card:", err);
        setSaveStatus("error");
      }
    },
    [board.id, board.workspaceId, cardTypeMap, setNodes]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      setSaveStatus("saving");
      try {
        await deleteV2Card(cardId);
        setNodes((current) => current.filter((node) => node.id !== cardId));
        setEdges((current) =>
          current.filter((edge) => edge.source !== cardId && edge.target !== cardId)
        );
        setConnectionRecords((current) =>
          current.filter(
            (connection) =>
              connection.sourceCardId !== cardId && connection.targetCardId !== cardId
          )
        );
        setSelectedCardId((current) => (current === cardId ? null : current));
        setVisualEditingCardId((current) => (current === cardId ? null : current));
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to delete card:", err);
        setSaveStatus("error");
      }
    },
    [setEdges, setNodes]
  );

  // ── Sync dynamic state into node data ────────────────────────────
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isVisualEditing: visualEditingCardId === node.id,
          onStartVisualEditor: handleStartVisualEditor,
          onDuplicateCard: handleDuplicateCard,
          onDeleteCard: handleDeleteCard,
          onResizeCard: handleResizeCard,
          onUpdateVisualStyle: handleUpdateVisualStyle,
          onCloseVisualEditor: () => setVisualEditingCardId(null),
        },
      }))
    );
  }, [
    setNodes,
    visualEditingCardId,
    handleStartVisualEditor,
    handleDuplicateCard,
    handleDeleteCard,
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
        nodesRef.current.find((node) => node.id === source)?.data.card.cardTypeId ?? ""
      );
      const targetType = cardTypeMap.get(
        nodesRef.current.find((node) => node.id === target)?.data.card.cardTypeId ?? ""
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
        setConnectionRecords((prev) => [...prev, created]);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to create connection:", err);
        setSaveStatus("error");
      }
    },
    [board.id, cardTypeMap, setEdges]
  );

  // ── Delete connection ────────────────────────────────────────────
  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        deleteV2Connection(edge.id).catch((err) =>
          console.error("Failed to delete connection:", err)
        );
      }
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id));
      setConnectionRecords((current) =>
        current.filter((connection) => !deletedIds.has(connection.id))
      );
    },
    []
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onNodeDoubleClick={handleNodeDoubleClick}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        onPaneClick={() => {
          setSelectedCardId(null);
          setVisualEditingCardId(null);
        }}
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
      {selectedCard ? (
        <V2CardInspector
          card={selectedCard}
          cardType={selectedCardType}
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
          saveStatus={saveStatus}
          onUpdateCardBasics={handleUpdateCardBasics}
          onClose={() => setSelectedCardId(null)}
        />
      ) : null}
    </>
  );
}
