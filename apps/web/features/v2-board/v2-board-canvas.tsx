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
  type Viewport,
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
import { V2CardCreateToolbar } from "./v2-card-create-toolbar";
import {
  createV2Card,
  updateV2CardPosition,
  updateV2CardSize,
  updateV2CardVisualStyle,
  updateV2CardBasics,
  updateV2CardData,
  createV2Connection,
  deleteV2Connection,
  deleteV2Card,
  duplicateV2Card,
} from "./api";

type Props = {
  boardDetail: V2BoardDetail;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type CardAction = "duplicate" | "delete";
type PendingCardAction = {
  cardId: string;
  action: CardAction;
} | null;
type CardActionError = {
  cardId: string;
  message: string;
} | null;

function getBoardViewportStorageKey(boardId: string): string {
  return `yadraw:v2-board:${boardId}:viewport`;
}

function readStoredBoardViewport(boardId: string): Viewport | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getBoardViewportStorageKey(boardId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Viewport>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.zoom !== "number" ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y) ||
      !Number.isFinite(parsed.zoom) ||
      parsed.zoom < 0.2 ||
      parsed.zoom > 2.5
    ) {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
      zoom: parsed.zoom,
    };
  } catch {
    return null;
  }
}

function storeBoardViewport(boardId: string, viewport: Viewport): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getBoardViewportStorageKey(boardId),
      JSON.stringify({
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      })
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

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
  const [storedViewport] = useState<Viewport | null>(() => readStoredBoardViewport(board.id));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [pendingCardAction, setPendingCardAction] = useState<PendingCardAction>(null);
  const [cardActionError, setCardActionError] = useState<CardActionError>(null);
  const cardActionLockRef = useRef<PendingCardAction>(null);

  // ── Visual edit mode (state only — handlers below useNodesState) ──
  const [visualEditingCardId, setVisualEditingCardId] = useState<string | null>(null);
  const ignoreNextPaneClickRef = useRef(false);

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

  const connectedPortKeyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    function addPort(cardId: string, portKey: string) {
      const keys = map.get(cardId) ?? new Set<string>();
      keys.add(portKey);
      map.set(cardId, keys);
    }

    for (const connection of connectionRecords) {
      addPort(connection.sourceCardId, connection.sourcePortKey);
      addPort(connection.targetCardId, connection.targetPortKey);
    }

    return map;
  }, [connectionRecords]);

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
      const touchesConnectorSlots = Object.prototype.hasOwnProperty.call(
        patch,
        "connectorSlots"
      );
      const node = nodesRef.current.find((n) => n.id === cardId);
      const current = (node?.data as { card?: { visualStyle?: V2CardVisualStyle } })?.card?.visualStyle ?? {};
      const previousConnectorSlots = current.connectorSlots;
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
        if (touchesConnectorSlots) {
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id !== cardId) return n;
              const currentVisualStyle = n.data.card.visualStyle ?? {};
              const restoredVisualStyle = { ...currentVisualStyle } as V2CardVisualStyle;
              if (previousConnectorSlots === undefined) {
                delete restoredVisualStyle.connectorSlots;
              } else {
                restoredVisualStyle.connectorSlots = previousConnectorSlots;
              }
              return {
                ...n,
                data: {
                  ...n.data,
                  card: { ...n.data.card, visualStyle: restoredVisualStyle },
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

  const handleUpdateCardData = useCallback(
    async (cardId: string, data: Record<string, unknown>) => {
      const previous = nodesRef.current.find((node) => node.id === cardId)?.data.card.data;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id !== cardId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              card: {
                ...node.data.card,
                data,
              },
            },
          };
        })
      );

      setSaveStatus("saving");
      try {
        await updateV2CardData(cardId, data);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save card data:", err);
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
                    data: previous,
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
    setSelectedCardId(cardId);
    setVisualEditingCardId(cardId);
    setCardActionError(null);
  }, []);

  const handleConnectorSlotDragStart = useCallback(() => {
    ignoreNextPaneClickRef.current = true;
  }, []);

  const handleConnectorSlotDragEnd = useCallback((moved: boolean) => {
    if (!moved) {
      ignoreNextPaneClickRef.current = false;
      return;
    }
    window.setTimeout(() => {
      ignoreNextPaneClickRef.current = false;
    }, 250);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_event: unknown, node: V2CardNode) => {
      handleStartVisualEditor(node.id);
    },
    [handleStartVisualEditor]
  );

  const handleDuplicateCard = useCallback(
    async (cardId: string) => {
      if (cardActionLockRef.current) return;
      const pending = { cardId, action: "duplicate" as const };
      cardActionLockRef.current = pending;
      setPendingCardAction(pending);
      setCardActionError(null);
      setSaveStatus("saving");
      try {
        const created = await duplicateV2Card(cardId);

        setNodes((current) => [
          ...current,
          buildCardNode(created, cardTypeMap, board.workspaceId),
        ]);
        setSelectedCardId(created.id);
        setVisualEditingCardId(null);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to duplicate card:", err);
        setCardActionError({
          cardId,
          message: "Could not duplicate this card.",
        });
        setSaveStatus("error");
        throw err;
      } finally {
        cardActionLockRef.current = null;
        setPendingCardAction(null);
      }
    },
    [board.workspaceId, cardTypeMap, setNodes]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (cardActionLockRef.current) return;
      if (
        !window.confirm(
          "Удалить карточку? Связи с ней будут удалены с доски. Файлы останутся в хранилище."
        )
      ) {
        return;
      }
      const pending = { cardId, action: "delete" as const };
      cardActionLockRef.current = pending;
      setPendingCardAction(pending);
      setCardActionError(null);
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
        setCardActionError({
          cardId,
          message: "Could not delete this card.",
        });
        setSaveStatus("error");
        throw err;
      } finally {
        cardActionLockRef.current = null;
        setPendingCardAction(null);
      }
    },
    [setEdges, setNodes]
  );

  const handleCreateCard = useCallback(
    async (
      cardType: V2CardType,
      position: { x: number; y: number }
    ) => {
      setSaveStatus("saving");
      try {
        const created = await createV2Card(board.id, {
          cardTypeId: cardType.id,
          title: cardType.name,
          description: "",
          data: {},
          position,
          size: clampCardSize(cardType.defaultSize),
        });

        setNodes((current) => [
          ...current,
          buildCardNode(created, cardTypeMap, board.workspaceId),
        ]);
        setSelectedCardId(created.id);
        setVisualEditingCardId(null);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to create card:", err);
        setSaveStatus("error");
        throw err;
      }
    },
    [board.id, board.workspaceId, cardTypeMap, setNodes]
  );

  // ── Sync dynamic state into node data ────────────────────────────
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isCardActionPending: pendingCardAction?.cardId === node.id,
          pendingCardAction: pendingCardAction?.cardId === node.id ? pendingCardAction.action : null,
          cardActionError: cardActionError?.cardId === node.id ? cardActionError.message : null,
          connectedPortKeys: Array.from(connectedPortKeyMap.get(node.id) ?? []),
          isVisualEditing: visualEditingCardId === node.id,
          onStartVisualEditor: handleStartVisualEditor,
          onDuplicateCard: handleDuplicateCard,
          onDeleteCard: handleDeleteCard,
          onResizeCard: handleResizeCard,
          onUpdateVisualStyle: handleUpdateVisualStyle,
          onCloseVisualEditor: () => setVisualEditingCardId(null),
          onConnectorSlotDragStart: handleConnectorSlotDragStart,
          onConnectorSlotDragEnd: handleConnectorSlotDragEnd,
        },
      }))
    );
  }, [
    setNodes,
    visualEditingCardId,
    pendingCardAction,
    cardActionError,
    connectedPortKeyMap,
    handleStartVisualEditor,
    handleDuplicateCard,
    handleDeleteCard,
    handleResizeCard,
    handleUpdateVisualStyle,
    handleConnectorSlotDragStart,
    handleConnectorSlotDragEnd,
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
          if (ignoreNextPaneClickRef.current) {
            ignoreNextPaneClickRef.current = false;
            return;
          }
          setSelectedCardId(null);
          setVisualEditingCardId(null);
        }}
        nodeTypes={nodeTypes}
        defaultViewport={storedViewport ?? undefined}
        fitView={!storedViewport}
        fitViewOptions={{ padding: 0.3 }}
        onMoveEnd={(_event, viewport) => {
          storeBoardViewport(board.id, viewport);
        }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <V2CardCreateToolbar
          cardTypes={cardTypes}
          onCreateCard={handleCreateCard}
        />
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
          pendingAction={pendingCardAction?.cardId === selectedCard.id ? pendingCardAction.action : null}
          actionError={cardActionError?.cardId === selectedCard.id ? cardActionError.message : null}
          onUpdateCardBasics={handleUpdateCardBasics}
          onUpdateCardData={handleUpdateCardData}
          onDuplicateCard={handleDuplicateCard}
          onDeleteCard={handleDeleteCard}
          onClose={() => setSelectedCardId(null)}
        />
      ) : null}
    </>
  );
}
