"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  type Edge,
  type Connection,
  type OnReconnect,
  type Viewport,
} from "@xyflow/react";
import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Bot, Play } from "lucide-react";
import type {
  V2BoardDetail,
  V2Card,
  V2Connection,
  V2ConnectionType,
  V2ConnectionVisualStyle,
  V2CardType,
  V2CardVisualStyle,
  V2DryRunResult,
  V2LinkedFieldBinding,
} from "@yadraw/shared";
import {
  V2_CARD_MIN_SIZE,
  V2CardNodeComponent,
  type V2CardNode,
} from "./v2-card-node";
import { V2CardInspector } from "./v2-card-inspector";
import { V2ConnectorInspector } from "./v2-connector-inspector";
import { V2ConnectorVisualEditPanel } from "./v2-connector-visual-edit-panel";
import { V2CardVisualEditPanel } from "./v2-card-visual-edit-panel";
import { V2ConnectorEdge, type V2ConnectorEdgeData } from "./v2-connector-edge";
import { V2CardCreateToolbar } from "./v2-card-create-toolbar";
import { buildV2ConnectorSlots } from "./v2-connector-slots";
import {
  createV2CardType,
  createV2ConnectionType,
  createV2Card,
  updateV2CardPosition,
  updateV2CardSize,
  updateV2CardVisualStyle,
  updateV2CardBasics,
  updateV2CardData,
  createV2Connection,
  deleteV2Connection,
  updateV2Connection,
  deleteV2Card,
  duplicateV2Card,
  runV2BoardDryRun,
  listV2LinkedFieldBindings,
  createV2LinkedFieldBinding,
  updateV2LinkedFieldBinding,
  deleteV2LinkedFieldBinding,
  updateV2CardType,
  updateV2ConnectionType,
  V2ApiError,
} from "./api";
import { V2AiAssistantPanel } from "./v2-ai-assistant-panel";
import type { V2BoardAssistantContext } from "./v2-board-assistant";
import { V2RunDryRunPanel } from "./v2-run-dry-run-panel";
import { V2CardTypeManager } from "./v2-card-type-manager";
import { V2ConnectionTypeManager } from "./v2-connection-type-manager";
import { resolveCardTypeAccentKey } from "./v2-theme-tokens";

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
  card: V2Card | undefined,
  cardType: V2CardType | undefined,
  handleId: string,
  direction: "input" | "output"
): boolean {
  if (!card || !cardType) return false;
  return buildV2ConnectorSlots({
    visualStyle: card.visualStyle,
    ports: cardType.ports,
  }).some(
    (slot) =>
      slot.portKey === handleId &&
      (direction === "output"
        ? slot.type === "output" || slot.type === "receiver"
        : slot.type === "input" || slot.type === "receiver")
  );
}

function getConnectionEdgeLabel(connection: V2Connection): string | undefined {
  if (connection.title?.trim()) return connection.title.trim();
  const quantity = connection.data?.quantity;
  const unit = connection.data?.unit;
  if (
    (typeof quantity === "number" || typeof quantity === "string") &&
    String(quantity).trim()
  ) {
    const unitText = typeof unit === "string" ? unit.trim() : "";
    return unitText ? `${quantity} ${unitText}` : String(quantity);
  }
  return connection.label || undefined;
}

type V2StyledEdge = Edge<V2ConnectorEdgeData> & {
  pathOptions?: {
    borderRadius?: number;
  };
};

const V2_CONNECTOR_MARKER_IDS = {
  arrow: "v2ConnectorMarkerArrow",
  reverseArrow: "v2ConnectorMarkerReverseArrow",
  triangle: "v2ConnectorMarkerTriangle",
  circle: "v2ConnectorMarkerCircle",
  square: "v2ConnectorMarkerSquare",
} as const;

function getConnectionMarkerId(
  marker: V2ConnectionVisualStyle["markerEnd"] | V2ConnectionVisualStyle["markerStart"]
): string | undefined {
  if (!marker || marker === "none") return undefined;
  return V2_CONNECTOR_MARKER_IDS[marker];
}

function getConnectionStrokeColor(visualStyle: V2ConnectionVisualStyle | undefined): string {
  return visualStyle?.strokeColor ?? "var(--yd-graph-connector)";
}

function getConnectionStrokeWidth(visualStyle: V2ConnectionVisualStyle | undefined): number {
  return visualStyle?.strokeWidth ?? 1.5;
}

function getConnectionCornerRadius(visualStyle: V2ConnectionVisualStyle | undefined): number {
  return visualStyle?.cornerRadius ?? 12;
}

function buildConnectionEdge(connection: V2Connection): V2StyledEdge {
  const visualStyle = connection.visualStyle ?? {};
  return {
    id: connection.id,
    source: connection.sourceCardId,
    target: connection.targetCardId,
    sourceHandle: connection.sourcePortKey,
    targetHandle: connection.targetPortKey,
    label: getConnectionEdgeLabel(connection),
    type: "v2Connector",
    deletable: false,
    reconnectable: true,
    data: {
      connection,
    },
    animated: false,
    markerStart: getConnectionMarkerId(visualStyle.markerStart),
    markerEnd: getConnectionMarkerId(visualStyle.markerEnd ?? "arrow"),
    pathOptions: {
      borderRadius: getConnectionCornerRadius(visualStyle),
    },
    style: {
      stroke: getConnectionStrokeColor(visualStyle),
      strokeWidth: getConnectionStrokeWidth(visualStyle),
    },
    labelStyle: {
      fontSize: 11,
      fill: "var(--yd-text-muted)",
      fontWeight: 500,
    },
  };
}

function applyConnectionToEdge(edge: Edge, connection: V2Connection): V2StyledEdge {
  return {
    ...edge,
    ...buildConnectionEdge(connection),
    data: {
      ...(edge.data ?? {}),
      connection,
    },
    selected: edge.selected,
  };
}

function isSameConnectionEndpoint(
  connection: V2Connection,
  input: {
    sourceCardId: string;
    targetCardId: string;
    sourcePortKey: string;
    targetPortKey: string;
    type?: string;
  }
): boolean {
  return (
    connection.sourceCardId === input.sourceCardId &&
    connection.targetCardId === input.targetCardId &&
    connection.sourcePortKey === input.sourcePortKey &&
    connection.targetPortKey === input.targetPortKey &&
    connection.type === (input.type ?? "data")
  );
}

function getConnectionEndpointKey(input: {
  sourceCardId: string;
  targetCardId: string;
  sourcePortKey: string;
  targetPortKey: string;
  type?: string;
}): string {
  return [
    input.sourceCardId,
    input.sourcePortKey,
    input.targetCardId,
    input.targetPortKey,
    input.type ?? "data",
  ].join("::");
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
    schema: { fields: [] },
    defaultVisualStyle: {},
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

function getV2CardTypeAccentToken(cardType: V2CardType | null | undefined): string {
  return `var(--yd-accent-${resolveCardTypeAccentKey(cardType)}-solid)`;
}

function getMiniMapNodeColor(node: V2CardNode): string {
  return getV2CardTypeAccentToken(node.data.cardType);
}

export function V2BoardCanvas({ boardDetail }: Props) {
  const { board, cards, connections, cardTypes: initialCardTypes, connectionTypes: initialConnectionTypes } = boardDetail;
  const [cardTypes, setCardTypes] = useState<V2CardType[]>(initialCardTypes);
  const [connectionTypes, setConnectionTypes] = useState<V2ConnectionType[]>(initialConnectionTypes);
  const cardTypeMap = useMemo(() => buildCardTypeMap(cardTypes), [cardTypes]);
  const [storedViewport] = useState<Viewport | null>(() => readStoredBoardViewport(board.id));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [pendingCardAction, setPendingCardAction] = useState<PendingCardAction>(null);
  const [cardActionError, setCardActionError] = useState<CardActionError>(null);
  const [connectionCreateError, setConnectionCreateError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<V2DryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [isDryRunRunning, setIsDryRunRunning] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCardTypeManagerOpen, setIsCardTypeManagerOpen] = useState(false);
  const [cardTypeManagerInitialId, setCardTypeManagerInitialId] = useState<string | null>(null);
  const [isConnectionTypeManagerOpen, setIsConnectionTypeManagerOpen] = useState(false);
  const [connectionTypeManagerInitialId, setConnectionTypeManagerInitialId] = useState<string | null>(null);
  const [linkedFieldBindings, setLinkedFieldBindings] = useState<V2LinkedFieldBinding[]>([]);
  const [linkedFieldBindingsError, setLinkedFieldBindingsError] = useState<string | null>(null);
  const [linkedFieldBindingsLoading, setLinkedFieldBindingsLoading] = useState(false);
  const cardActionLockRef = useRef<PendingCardAction>(null);

  // ── Visual edit mode (state only — handlers below useNodesState) ──
  const [visualEditingCardId, setVisualEditingCardId] = useState<string | null>(null);
  const [visualEditingConnectionId, setVisualEditingConnectionId] = useState<string | null>(null);
  const ignoreNextPaneClickRef = useRef(false);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: V2CardNode[] = cards.map((card: V2Card) =>
      buildCardNode(card, cardTypeMap, board.workspaceId)
    );

    const edges: Edge[] = connections.map((conn: V2Connection) => buildConnectionEdge(conn));

    return { nodes, edges };
  }, [cards, connections, cardTypeMap, board.workspaceId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [connectionRecords, setConnectionRecords] = useState<V2Connection[]>(connections);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const connectionRecordsRef = useRef(connectionRecords);
  const pendingConnectionKeysRef = useRef(new Set<string>());

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    connectionRecordsRef.current = connectionRecords;
  }, [connectionRecords]);

  useEffect(() => {
    let cancelled = false;
    setLinkedFieldBindingsLoading(true);
    setLinkedFieldBindingsError(null);
    listV2LinkedFieldBindings(board.id)
      .then((bindings) => {
        if (cancelled) return;
        setLinkedFieldBindings(bindings);
      })
      .catch((err) => {
        console.error("Failed to load linked field bindings:", err);
        if (cancelled) return;
        setLinkedFieldBindingsError("Linked fields could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) {
          setLinkedFieldBindingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [board.id]);

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
  const selectedConnection = useMemo(
    () => connectionRecords.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connectionRecords, selectedConnectionId]
  );
  const selectedConnectionType = useMemo<V2ConnectionType | null>(() => {
    if (!selectedConnection) return null;
    return (
      connectionTypes.find((connectionType) => connectionType.id === selectedConnection.connectionTypeId) ??
      connectionTypes.find((connectionType) => connectionType.key === "generic") ??
      null
    );
  }, [connectionTypes, selectedConnection]);
  const genericConnectionType = useMemo(
    () => connectionTypes.find((connectionType) => connectionType.key === "generic") ?? null,
    [connectionTypes]
  );
  const assistantCards = useMemo(
    () => nodes.map((node) => node.data.card),
    [nodes]
  );
  const boardCards = assistantCards;
  const boardCardPreviewSignature = useMemo(
    () =>
      JSON.stringify(
        nodes.map((node) => ({
          id: node.data.card.id,
          cardTypeId: node.data.card.cardTypeId,
          title: node.data.card.title,
          description: node.data.card.description,
          data: node.data.card.data,
          updatedAt: node.data.card.updatedAt,
        }))
      ),
    [nodes]
  );
  const assistantContext = useMemo<V2BoardAssistantContext>(
    () => ({
      board,
      cards: assistantCards,
      connections: connectionRecords,
      cardTypes,
      selectedCardId,
      dryRunResult,
    }),
    [assistantCards, board, cardTypes, connectionRecords, dryRunResult, selectedCardId]
  );

  useEffect(() => {
    if (
      selectedConnectionId &&
      !connectionRecords.some((connection) => connection.id === selectedConnectionId)
    ) {
      setSelectedConnectionId(null);
      setVisualEditingConnectionId(null);
    }
  }, [connectionRecords, selectedConnectionId]);

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
      setSelectedConnectionId(null);
      setVisualEditingConnectionId(null);
      setConnectionCreateError(null);
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
    setSelectedConnectionId(null);
    setVisualEditingCardId(cardId);
    setVisualEditingConnectionId(null);
    setCardActionError(null);
    setConnectionCreateError(null);
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
      setConnectionCreateError(null);
      setSaveStatus("saving");
      try {
        const created = await duplicateV2Card(cardId);

        setNodes((current) => [
          ...current,
          buildCardNode(created, cardTypeMap, board.workspaceId),
        ]);
        setSelectedCardId(created.id);
        setSelectedConnectionId(null);
        setVisualEditingCardId(null);
        setVisualEditingConnectionId(null);
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
      const connectedCount = connectionRecordsRef.current.filter(
        (connection) => connection.sourceCardId === cardId || connection.targetCardId === cardId
      ).length;
      const connectorWarning =
        connectedCount > 0
          ? ` ${connectedCount} connected connector${connectedCount === 1 ? "" : "s"} will also be removed.`
          : "";
      if (
        !window.confirm(
          `Delete this card?${connectorWarning} Files will stay in storage.`
        )
      ) {
        return;
      }
      const pending = { cardId, action: "delete" as const };
      cardActionLockRef.current = pending;
      setPendingCardAction(pending);
      setCardActionError(null);
      setConnectionCreateError(null);
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
        setSelectedConnectionId(null);
        setVisualEditingCardId((current) => (current === cardId ? null : current));
        setVisualEditingConnectionId(null);
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
      setConnectionCreateError(null);
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
        setSelectedConnectionId(null);
        setVisualEditingCardId(null);
        setVisualEditingConnectionId(null);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to create card:", err);
        setSaveStatus("error");
        throw err;
      }
    },
    [board.id, board.workspaceId, cardTypeMap, setNodes]
  );

  const applyCardTypeToState = useCallback(
    (cardType: V2CardType) => {
      setCardTypes((current) => {
        const exists = current.some((item) => item.id === cardType.id);
        return exists
          ? current.map((item) => (item.id === cardType.id ? cardType : item))
          : [...current, cardType];
      });
      setNodes((current) =>
        current.map((node) => {
          if (node.data.card.cardTypeId !== cardType.id) return node;
          return {
            ...node,
            data: {
              ...node.data,
              cardType,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const handleOpenCardTypeManager = useCallback((cardTypeId?: string | null) => {
    setCardTypeManagerInitialId(cardTypeId ?? null);
    setIsCardTypeManagerOpen(true);
  }, []);

  const applyConnectionTypeToState = useCallback((connectionType: V2ConnectionType) => {
    setConnectionTypes((current) => {
      const exists = current.some((item) => item.id === connectionType.id);
      return exists
        ? current.map((item) => (item.id === connectionType.id ? connectionType : item))
        : [...current, connectionType];
    });
  }, []);

  const handleOpenConnectionTypeManager = useCallback((connectionTypeId?: string | null) => {
    setConnectionTypeManagerInitialId(connectionTypeId ?? null);
    setIsConnectionTypeManagerOpen(true);
  }, []);

  const handleCreateCardType = useCallback(
    async (input: Parameters<typeof createV2CardType>[1]) => {
      setSaveStatus("saving");
      try {
        const created = await createV2CardType(board.id, input);
        applyCardTypeToState(created);
        setSaveStatus("saved");
        return created;
      } catch (error) {
        console.error("Failed to create card type:", error);
        setSaveStatus("error");
        throw error;
      }
    },
    [applyCardTypeToState, board.id]
  );

  const handleUpdateCardType = useCallback(
    async (cardTypeId: string, input: Parameters<typeof updateV2CardType>[2]) => {
      setSaveStatus("saving");
      try {
        const updated = await updateV2CardType(board.id, cardTypeId, input);
        applyCardTypeToState(updated);
        setSaveStatus("saved");
        return updated;
      } catch (error) {
        console.error("Failed to update card type:", error);
        setSaveStatus("error");
        throw error;
      }
    },
    [applyCardTypeToState, board.id]
  );

  const handleCreateConnectionType = useCallback(
    async (input: Parameters<typeof createV2ConnectionType>[1]) => {
      setSaveStatus("saving");
      try {
        const created = await createV2ConnectionType(board.id, input);
        applyConnectionTypeToState(created);
        setSaveStatus("saved");
        return created;
      } catch (error) {
        console.error("Failed to create connection type:", error);
        setSaveStatus("error");
        throw error;
      }
    },
    [applyConnectionTypeToState, board.id]
  );

  const handleUpdateConnectionType = useCallback(
    async (connectionTypeId: string, input: Parameters<typeof updateV2ConnectionType>[2]) => {
      setSaveStatus("saving");
      try {
        const updated = await updateV2ConnectionType(board.id, connectionTypeId, input);
        applyConnectionTypeToState(updated);
        setSaveStatus("saved");
        return updated;
      } catch (error) {
        console.error("Failed to update connection type:", error);
        setSaveStatus("error");
        throw error;
      }
    },
    [applyConnectionTypeToState, board.id]
  );

  const handleRunDryRun = useCallback(async () => {
    setIsDryRunRunning(true);
    setDryRunError(null);
    try {
      const result = await runV2BoardDryRun(
        board.id,
        selectedCardId ? { startCardId: selectedCardId } : {}
      );
      setDryRunResult(result);
    } catch (err) {
      console.error("Failed to run dry-run:", err);
      setDryRunError("Dry-run could not be completed.");
    } finally {
      setIsDryRunRunning(false);
    }
  }, [board.id, selectedCardId]);

  const handleCreateLinkedFieldBinding = useCallback(
    async (input: Parameters<typeof createV2LinkedFieldBinding>[1]) => {
      setLinkedFieldBindingsError(null);
      try {
        const created = await createV2LinkedFieldBinding(board.id, input);
        setLinkedFieldBindings((current) => [...current, created]);
      } catch (err) {
        console.error("Failed to create linked field binding:", err);
        setLinkedFieldBindingsError("Linked field could not be saved.");
        throw err;
      }
    },
    [board.id]
  );

  const handleUpdateLinkedFieldBinding = useCallback(
    async (
      bindingId: string,
      input: Parameters<typeof updateV2LinkedFieldBinding>[2]
    ) => {
      setLinkedFieldBindingsError(null);
      try {
        const updated = await updateV2LinkedFieldBinding(board.id, bindingId, input);
        setLinkedFieldBindings((current) =>
          current.map((binding) => (binding.id === bindingId ? updated : binding))
        );
      } catch (err) {
        console.error("Failed to update linked field binding:", err);
        setLinkedFieldBindingsError("Linked field changes could not be saved.");
        throw err;
      }
    },
    [board.id]
  );

  const handleDeleteLinkedFieldBinding = useCallback(
    async (bindingId: string) => {
      setLinkedFieldBindingsError(null);
      try {
        await deleteV2LinkedFieldBinding(board.id, bindingId);
        setLinkedFieldBindings((current) =>
          current.filter((binding) => binding.id !== bindingId)
        );
      } catch (err) {
        console.error("Failed to delete linked field binding:", err);
        setLinkedFieldBindingsError("Linked field could not be removed.");
        throw err;
      }
    },
    [board.id]
  );

  // ── Sync dynamic state into node data ────────────────────────────
  useEffect(() => {
    const previewCards = nodesRef.current.map((node) => node.data.card);

    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          allCards: previewCards,
          allConnections: connectionRecordsRef.current,
          cardTypes,
          linkedFieldBindings,
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
    boardCardPreviewSignature,
    cardTypes,
    linkedFieldBindings,
    connectionRecords,
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

  const handleUpdateConnection = useCallback(
    async (
      connectionId: string,
      patch: {
        title?: string | null;
        description?: string | null;
        connectionTypeId?: string | null;
        sourceCardId?: string;
        targetCardId?: string;
        sourcePortKey?: string;
        targetPortKey?: string;
        data?: Record<string, unknown>;
        visualStyle?: V2ConnectionVisualStyle;
      }
    ) => {
      const previous = connectionRecords.find((connection) => connection.id === connectionId);
      if (!previous) return;
      const optimistic: V2Connection = {
        ...previous,
        ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
        ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
        ...(patch.connectionTypeId !== undefined ? { connectionTypeId: patch.connectionTypeId } : {}),
        ...(patch.sourceCardId !== undefined ? { sourceCardId: patch.sourceCardId } : {}),
        ...(patch.targetCardId !== undefined ? { targetCardId: patch.targetCardId } : {}),
        ...(patch.sourcePortKey !== undefined ? { sourcePortKey: patch.sourcePortKey } : {}),
        ...(patch.targetPortKey !== undefined ? { targetPortKey: patch.targetPortKey } : {}),
        ...(patch.data !== undefined ? { data: patch.data } : {}),
        ...(patch.visualStyle !== undefined
          ? { visualStyle: { ...previous.visualStyle, ...patch.visualStyle } }
          : {}),
      };

      setConnectionRecords((current) =>
        current.map((connection) => (connection.id === connectionId ? optimistic : connection))
      );
      setEdges((current) =>
        current.map((edge) =>
          edge.id === connectionId
            ? applyConnectionToEdge(edge, optimistic)
            : edge
        )
      );

      setSaveStatus("saving");
      try {
        const updated = await updateV2Connection(connectionId, patch);
        setConnectionRecords((current) =>
          current.map((connection) => (connection.id === connectionId ? updated : connection))
        );
        setEdges((current) =>
          current.map((edge) =>
            edge.id === connectionId
              ? applyConnectionToEdge(edge, updated)
              : edge
          )
        );
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to update connection:", err);
        setConnectionRecords((current) =>
          current.map((connection) => (connection.id === connectionId ? previous : connection))
        );
        setEdges((current) =>
          current.map((edge) =>
            edge.id === connectionId
              ? applyConnectionToEdge(edge, previous)
              : edge
          )
        );
        setSaveStatus("error");
        throw err;
      }
    },
    [connectionRecords, setEdges]
  );

  const handlePreviewConnectionVisualStyle = useCallback(
    (connectionId: string, visualStyle: V2ConnectionVisualStyle) => {
      const current = connectionRecordsRef.current.find((connection) => connection.id === connectionId);
      if (!current) return;
      const previewConnection: V2Connection = {
        ...current,
        visualStyle: { ...current.visualStyle, ...visualStyle },
      };

      setEdges((existingEdges) =>
        existingEdges.map((edge) =>
          edge.id === connectionId ? applyConnectionToEdge(edge, previewConnection) : edge
        )
      );
    },
    [setEdges]
  );

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      const connection = connectionRecordsRef.current.find((item) => item.id === connectionId);
      if (!connection) return;
      if (!window.confirm("Delete this connector? Cards and files will stay unchanged.")) {
        return;
      }

      setSaveStatus("saving");
      setConnectionCreateError(null);
      try {
        await deleteV2Connection(connectionId);
        setConnectionRecords((current) => current.filter((item) => item.id !== connectionId));
        setEdges((current) => current.filter((edge) => edge.id !== connectionId));
        setSelectedConnectionId((current) => (current === connectionId ? null : current));
        setVisualEditingConnectionId((current) => (current === connectionId ? null : current));
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to delete connection:", err);
        setConnectionCreateError("Connector could not be deleted.");
        setSaveStatus("error");
        throw err;
      }
    },
    [setEdges]
  );

  const handleEdgeClick = useCallback((event: ReactMouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedConnectionId(edge.id);
    setSelectedCardId(null);
    setVisualEditingCardId(null);
    setVisualEditingConnectionId((current) => (current === edge.id ? current : null));
    setCardActionError(null);
    setConnectionCreateError(null);
  }, []);

  const handleEdgeDoubleClick = useCallback((event: ReactMouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedConnectionId(edge.id);
    setSelectedCardId(null);
    setVisualEditingCardId(null);
    setVisualEditingConnectionId(edge.id);
    setCardActionError(null);
    setConnectionCreateError(null);
  }, []);

  // ── Create connection ────────────────────────────────────────────
  const handleConnect = useCallback(
    async (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target || !sourceHandle || !targetHandle) return;

      // Basic client-side validation via card types
      const sourceCard = nodesRef.current.find((node) => node.id === source)?.data.card;
      const targetCard = nodesRef.current.find((node) => node.id === target)?.data.card;
      const sourceType = sourceCard ? cardTypeMap.get(sourceCard.cardTypeId) : undefined;
      const targetType = targetCard ? cardTypeMap.get(targetCard.cardTypeId) : undefined;
      const canConnectAsDrawn =
        isValidHandle(sourceCard, sourceType, sourceHandle, "output") &&
        isValidHandle(targetCard, targetType, targetHandle, "input");
      const canConnectReversed =
        isValidHandle(targetCard, targetType, targetHandle, "output") &&
        isValidHandle(sourceCard, sourceType, sourceHandle, "input");

      if (!canConnectAsDrawn && !canConnectReversed) {
        console.error(
          "Invalid connection: source handle must be output, target handle must be input"
        );
        setConnectionCreateError("Connection could not be created.");
        setSaveStatus("error");
        return;
      }

      const connectionInput = canConnectAsDrawn
        ? {
            sourceCardId: source,
            targetCardId: target,
            sourcePortKey: sourceHandle,
            targetPortKey: targetHandle,
          }
        : {
            sourceCardId: target,
            targetCardId: source,
            sourcePortKey: targetHandle,
            targetPortKey: sourceHandle,
          };
      const createInput = {
        ...connectionInput,
        connectionTypeId: genericConnectionType?.id ?? null,
        type: "data",
        label: connectionInput.sourcePortKey,
      };
      const duplicate = connectionRecordsRef.current.find((record) =>
        isSameConnectionEndpoint(record, createInput)
      );
      if (duplicate) {
        setSelectedConnectionId(duplicate.id);
        setSelectedCardId(null);
        setConnectionCreateError("Connection already exists.");
        setSaveStatus("error");
        return;
      }
      const endpointKey = getConnectionEndpointKey(createInput);
      if (pendingConnectionKeysRef.current.has(endpointKey)) {
        return;
      }
      pendingConnectionKeysRef.current.add(endpointKey);

      const previousEdges = edgesRef.current;
      const previousConnectionRecords = connectionRecordsRef.current;

      setSaveStatus("saving");
      setConnectionCreateError(null);
      try {
        const created = await createV2Connection(board.id, createInput);

        // Add the new edge from the API response
        const newEdge: Edge = buildConnectionEdge(created);
        setEdges((prev) => [...prev, newEdge]);
        setConnectionRecords((prev) => [...prev, created]);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to create connection:", err);
        setEdges(previousEdges);
        setConnectionRecords(previousConnectionRecords);
        setConnectionCreateError(
          err instanceof V2ApiError && err.status === 409
            ? "Connection already exists."
            : "Connection could not be created."
        );
        setSaveStatus("error");
      } finally {
        pendingConnectionKeysRef.current.delete(endpointKey);
      }
    },
    [board.id, cardTypeMap, genericConnectionType?.id, setEdges]
  );

  const handleReconnect = useCallback<OnReconnect>(
    async (oldEdge, connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target || !sourceHandle || !targetHandle) {
        setConnectionCreateError("Connector could not be retargeted.");
        setSaveStatus("error");
        return;
      }

      const existing = connectionRecordsRef.current.find((record) => record.id === oldEdge.id);
      if (!existing) return;

      const sourceCard = nodesRef.current.find((node) => node.id === source)?.data.card;
      const targetCard = nodesRef.current.find((node) => node.id === target)?.data.card;
      const sourceType = sourceCard ? cardTypeMap.get(sourceCard.cardTypeId) : undefined;
      const targetType = targetCard ? cardTypeMap.get(targetCard.cardTypeId) : undefined;
      const canConnectAsDrawn =
        isValidHandle(sourceCard, sourceType, sourceHandle, "output") &&
        isValidHandle(targetCard, targetType, targetHandle, "input");
      const canConnectReversed =
        isValidHandle(targetCard, targetType, targetHandle, "output") &&
        isValidHandle(sourceCard, sourceType, sourceHandle, "input");

      if (!canConnectAsDrawn && !canConnectReversed) {
        setConnectionCreateError("Connector could not be retargeted.");
        setSaveStatus("error");
        return;
      }

      const endpointPatch = canConnectAsDrawn
        ? {
            sourceCardId: source,
            targetCardId: target,
            sourcePortKey: sourceHandle,
            targetPortKey: targetHandle,
          }
        : {
            sourceCardId: target,
            targetCardId: source,
            sourcePortKey: targetHandle,
            targetPortKey: sourceHandle,
          };

      if (
        endpointPatch.sourceCardId === existing.sourceCardId &&
        endpointPatch.targetCardId === existing.targetCardId &&
        endpointPatch.sourcePortKey === existing.sourcePortKey &&
        endpointPatch.targetPortKey === existing.targetPortKey
      ) {
        return;
      }

      const duplicate = connectionRecordsRef.current.find(
        (record) =>
          record.id !== existing.id &&
          isSameConnectionEndpoint(record, {
            ...endpointPatch,
            type: existing.type,
          })
      );
      if (duplicate) {
        setSelectedConnectionId(duplicate.id);
        setSelectedCardId(null);
        setConnectionCreateError("Connection already exists.");
        setSaveStatus("error");
        return;
      }

      setConnectionCreateError(null);
      try {
        await handleUpdateConnection(existing.id, endpointPatch);
        setSelectedConnectionId(existing.id);
        setSelectedCardId(null);
      } catch (err) {
        console.error("Failed to retarget connection:", err);
        setConnectionCreateError(
          err instanceof V2ApiError && err.status === 409
            ? "Connection already exists."
            : "Connector could not be retargeted."
        );
      }
    },
    [cardTypeMap, handleUpdateConnection]
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
      setSelectedConnectionId((current) => (current && deletedIds.has(current) ? null : current));
      setVisualEditingConnectionId((current) => (current && deletedIds.has(current) ? null : current));
      setConnectionCreateError(null);
    },
    []
  );

  const edgeTypes = useMemo(
    () => ({
      v2Connector: V2ConnectorEdge,
    }),
    []
  );

  const displayedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const isSelected = edge.id === selectedConnectionId;
        const currentConnection =
          (edge.data as V2ConnectorEdgeData | undefined)?.connection ??
          connectionRecords.find((connection) => connection.id === edge.id);
        const baseStrokeWidth =
          typeof edge.style?.strokeWidth === "number" ? edge.style.strokeWidth : 1.5;
        return {
          ...edge,
          selected: isSelected,
          data: {
            ...(edge.data ?? {}),
            ...(currentConnection ? { connection: currentConnection } : {}),
            isVisualEditing: visualEditingConnectionId === edge.id,
            onPreviewVisualStyle: handlePreviewConnectionVisualStyle,
            onSaveVisualStyle: async (
              connectionId: string,
              visualStyle: V2ConnectionVisualStyle
            ) => {
              await handleUpdateConnection(connectionId, { visualStyle });
            },
          },
          style: {
            ...(edge.style ?? {}),
            stroke: isSelected
              ? "var(--yd-graph-connector-selected)"
              : edge.style?.stroke,
            strokeWidth: isSelected ? baseStrokeWidth + 1.25 : baseStrokeWidth,
          },
          labelStyle: {
            ...(edge.labelStyle ?? {}),
            fill: isSelected ? "var(--yd-graph-connector-selected)" : "var(--yd-text-muted)",
            fontWeight: isSelected ? 700 : 500,
          },
        };
      }),
    [
      connectionRecords,
      edges,
      handlePreviewConnectionVisualStyle,
      handleUpdateConnection,
      selectedConnectionId,
      visualEditingConnectionId,
    ]
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={displayedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={handleEdgeClick}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        onConnect={handleConnect}
        onReconnect={handleReconnect}
        onEdgesDelete={handleEdgesDelete}
        onPaneClick={() => {
          if (ignoreNextPaneClickRef.current) {
            ignoreNextPaneClickRef.current = false;
            return;
          }
          setSelectedCardId(null);
          setSelectedConnectionId(null);
          setVisualEditingCardId(null);
          setVisualEditingConnectionId(null);
          setConnectionCreateError(null);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={storedViewport ?? undefined}
        fitView={!storedViewport}
        fitViewOptions={{ padding: 0.3 }}
        onMoveEnd={(_event, viewport) => {
          storeBoardViewport(board.id, viewport);
        }}
        minZoom={0.2}
        maxZoom={2.5}
        connectionMode={ConnectionMode.Loose}
        edgesReconnectable={true}
        reconnectRadius={12}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <svg className="v2ConnectorMarkerDefs" aria-hidden="true" focusable="false">
          <defs>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.arrow}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 9 5 L 1 9 z" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.reverseArrow}
              viewBox="0 0 10 10"
              refX="2"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 9 1 L 1 5 L 9 9 z" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.triangle}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 9 5 L 1 9 z" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.circle}
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <circle cx="5" cy="5" r="3" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.square}
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <rect x="2" y="2" width="6" height="6" rx="1" fill="context-stroke" />
            </marker>
          </defs>
        </svg>
        <V2CardCreateToolbar
          cardTypes={cardTypes}
          onCreateCard={handleCreateCard}
          onManageCardTypes={handleOpenCardTypeManager}
        />
        <div className="v2RunToolbar nodrag nopan">
          <button
            type="button"
            className="v2AssistantOpenButton"
            onClick={() => setIsAssistantOpen((current) => !current)}
            aria-expanded={isAssistantOpen}
          >
            <Bot size={14} strokeWidth={2.4} />
            <span>AI Assistant</span>
          </button>
          <button
            type="button"
            className="v2RunDryRunButton"
            onClick={() => void handleRunDryRun()}
            disabled={isDryRunRunning}
            aria-busy={isDryRunRunning}
          >
            <Play size={14} strokeWidth={2.4} />
            <span>{isDryRunRunning ? "Running..." : "Run dry-run"}</span>
          </button>
          {dryRunError ? (
            <p className="v2RunDryRunError" role="alert">
              {dryRunError}
            </p>
          ) : null}
        </div>
        {isAssistantOpen ? (
          <V2AiAssistantPanel
            context={assistantContext}
            onClose={() => setIsAssistantOpen(false)}
          />
        ) : null}
        {dryRunResult ? (
          <V2RunDryRunPanel
            result={dryRunResult}
            onClose={() => setDryRunResult(null)}
          />
        ) : null}
        <Background color="var(--yd-border-subtle)" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          style={{
            border: "1px solid var(--yd-border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
          nodeColor={(node) => getMiniMapNodeColor(node as V2CardNode)}
          maskColor="rgba(0,0,0,0.08)"
        />
        {connectionCreateError ? (
          <div className="v2CanvasConnectionError" role="status">
            {connectionCreateError}
          </div>
        ) : null}
        {selectedCard && visualEditingCardId === selectedCard.id ? (
          <V2CardVisualEditPanel
            card={selectedCard}
            saveStatus={saveStatus}
            onUpdateVisualStyle={handleUpdateVisualStyle}
            onClose={() => setVisualEditingCardId(null)}
          />
        ) : null}
        {selectedConnection && visualEditingConnectionId === selectedConnection.id ? (
          <V2ConnectorVisualEditPanel
            connection={selectedConnection}
            saveStatus={saveStatus}
            onPreview={handlePreviewConnectionVisualStyle}
            onSave={async (connectionId, visualStyle) => {
              await handleUpdateConnection(connectionId, { visualStyle });
            }}
            onCancel={() => {
              handlePreviewConnectionVisualStyle(
                selectedConnection.id,
                selectedConnection.visualStyle
              );
              setVisualEditingConnectionId(null);
            }}
            onDelete={handleDeleteConnection}
          />
        ) : null}
      </ReactFlow>
      {selectedCard ? (
        <V2CardInspector
          card={selectedCard}
          cardType={selectedCardType}
          cardTypes={cardTypes}
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
          allCards={boardCards}
          allConnections={connectionRecords}
          linkedFieldBindings={linkedFieldBindings}
          linkedFieldBindingsLoading={linkedFieldBindingsLoading}
          linkedFieldBindingsError={linkedFieldBindingsError}
          saveStatus={saveStatus}
          pendingAction={pendingCardAction?.cardId === selectedCard.id ? pendingCardAction.action : null}
          actionError={cardActionError?.cardId === selectedCard.id ? cardActionError.message : null}
          onUpdateCardBasics={handleUpdateCardBasics}
          onUpdateCardData={handleUpdateCardData}
          onCreateLinkedFieldBinding={handleCreateLinkedFieldBinding}
          onUpdateLinkedFieldBinding={handleUpdateLinkedFieldBinding}
          onDeleteLinkedFieldBinding={handleDeleteLinkedFieldBinding}
          onManageCardType={handleOpenCardTypeManager}
          onDuplicateCard={handleDuplicateCard}
          onDeleteCard={handleDeleteCard}
          onClose={() => setSelectedCardId(null)}
        />
      ) : selectedConnection ? (
        <V2ConnectorInspector
          connection={selectedConnection}
          connectionType={selectedConnectionType}
          connectionTypes={connectionTypes}
          sourceCard={cardById.get(selectedConnection.sourceCardId) ?? null}
          targetCard={cardById.get(selectedConnection.targetCardId) ?? null}
          saveStatus={saveStatus}
          onUpdateConnection={handleUpdateConnection}
          onDeleteConnection={handleDeleteConnection}
          onManageConnectionType={handleOpenConnectionTypeManager}
          onClose={() => setSelectedConnectionId(null)}
        />
      ) : null}
      {isCardTypeManagerOpen ? (
        <V2CardTypeManager
          cardTypes={cardTypes}
          initialCardTypeId={cardTypeManagerInitialId}
          onCreateCardType={handleCreateCardType}
          onUpdateCardType={handleUpdateCardType}
          onClose={() => setIsCardTypeManagerOpen(false)}
        />
      ) : null}
      {isConnectionTypeManagerOpen ? (
        <V2ConnectionTypeManager
          connectionTypes={connectionTypes}
          initialConnectionTypeId={connectionTypeManagerInitialId}
          onCreateConnectionType={handleCreateConnectionType}
          onUpdateConnectionType={handleUpdateConnectionType}
          onClose={() => setIsConnectionTypeManagerOpen(false)}
        />
      ) : null}
    </>
  );
}
