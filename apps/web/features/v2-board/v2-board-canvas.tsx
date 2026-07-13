"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  SelectionMode,
  useNodesState,
  useEdgesState,
  type Edge,
  type Connection,
  type OnNodeDrag,
  type OnReconnect,
  type OnSelectionChangeParams,
  type NodeChange,
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
  V2CardAttachment,
  V2CalculationEvaluation,
  V2Connection,
  V2ConnectionType,
  V2ConnectionVisualStyle,
  V2CardType,
  V2CardVisualStyle,
  V2DryRunResult,
  V2LinkedFieldBinding,
} from "@yadraw/shared";
import {
  buildV2ConnectionDefaultData,
  getV2ConnectionSemanticLabel
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
import { V2ConnectionTypeToolbar } from "./v2-connection-type-toolbar";
import { buildV2ConnectorSlots } from "./v2-connector-slots";
import {
  createV2CardType,
  deleteV2CardType,
  createV2ConnectionType,
  createV2Card,
  updateV2BoardLayout,
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
  evaluateV2BoardCalculations,
  listV2LinkedFieldBindings,
  createV2LinkedFieldBinding,
  updateV2LinkedFieldBinding,
  deleteV2LinkedFieldBinding,
  updateV2CardType,
  updateV2ConnectionType,
  V2ApiError,
  listV2CardAttachments,
} from "./api";
import { V2AiAssistantPanel } from "./v2-ai-assistant-panel";
import type { V2BoardAssistantContext } from "./v2-board-assistant";
import { V2RunDryRunPanel } from "./v2-run-dry-run-panel";
import { V2CardTypeManager } from "./v2-card-type-manager";
import {
  V2ConnectionTypeManager,
  type V2NewConnectionTypeSeed,
} from "./v2-connection-type-manager";
import { V2FilePreviewModal } from "./v2-file-preview-modal";
import { resolveCardTypeAccentKey } from "./v2-theme-tokens";
import {
  buildV2ClipboardPayload,
  isEditableShortcutTarget,
  type V2ClipboardCard,
  type V2ClipboardPayload,
  type V2EditorCommand,
} from "./v2-editor-commands";
import type { SaveStatus } from "./v2-card-inspector-helpers";

type Props = {
  boardDetail: V2BoardDetail;
  initialCalculationEvaluation: V2CalculationEvaluation | null;
  onSaveStatusChange?: (status: SaveStatus) => void;
};

type CardAction = "duplicate" | "delete";
type PendingCardAction = {
  cardId: string;
  action: CardAction;
} | null;
type CardActionError = {
  cardId: string;
  message: string;
} | null;

type GroupDragSnapshot = {
  draggedNodeId: string;
  positions: Map<string, { x: number; y: number }>;
  manualConnections: V2Connection[];
};

type CardPositionUpdate = {
  cardId: string;
  position: { x: number; y: number };
};

type ConnectionVisualStyleUpdate = {
  connectionId: string;
  visualStyle: V2ConnectionVisualStyle;
};

const SHOW_EXPERIMENTAL_RUN_AI = false;
const V2_PASTE_OFFSET = 40;
const V2_HISTORY_LIMIT = 50;

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
  ring: "v2ConnectorMarkerRing",
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

function applyConnectionTypeStyle(
  currentStyle: V2ConnectionVisualStyle,
  connectionType: V2ConnectionType
): V2ConnectionVisualStyle {
  const defaults = connectionType.defaultVisualStyle;
  return {
    strokeColor: defaults.strokeColor ?? "#475467",
    strokeWidth: defaults.strokeWidth ?? 2,
    cornerRadius: defaults.cornerRadius ?? 12,
    markerStart: defaults.markerStart ?? "none",
    markerEnd: defaults.markerEnd ?? "arrow",
    showLabel: defaults.showLabel ?? true,
    ...(currentStyle.routeMode !== undefined ? { routeMode: currentStyle.routeMode } : {}),
    ...(currentStyle.waypoints !== undefined ? { waypoints: currentStyle.waypoints } : {}),
    ...(currentStyle.labelPosition !== undefined
      ? { labelPosition: currentStyle.labelPosition }
      : {}),
    ...(currentStyle.labelSegmentIndex !== undefined
      ? { labelSegmentIndex: currentStyle.labelSegmentIndex }
      : {}),
  };
}

function buildConnectionEdge(
  connection: V2Connection,
  connectionType?: V2ConnectionType | null
): V2StyledEdge {
  const visualStyle = connection.visualStyle ?? {};
  return {
    id: connection.id,
    source: connection.sourceCardId,
    target: connection.targetCardId,
    sourceHandle: connection.sourcePortKey,
    targetHandle: connection.targetPortKey,
    label: getV2ConnectionSemanticLabel(connection, connectionType),
    type: "v2Connector",
    deletable: false,
    reconnectable: true,
    data: {
      connection,
      connectionType,
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

function applyConnectionToEdge(
  edge: Edge,
  connection: V2Connection,
  connectionType?: V2ConnectionType | null
): V2StyledEdge {
  const resolvedConnectionType = connectionType ??
    (edge.data as V2ConnectorEdgeData | undefined)?.connectionType;
  return {
    ...edge,
    ...buildConnectionEdge(connection, resolvedConnectionType),
    data: {
      ...(edge.data ?? {}),
      connection,
      connectionType: resolvedConnectionType,
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
    connectionTypeId?: string | null;
    type?: string;
  }
): boolean {
  return (
    connection.sourceCardId === input.sourceCardId &&
    connection.targetCardId === input.targetCardId &&
    connection.sourcePortKey === input.sourcePortKey &&
    connection.targetPortKey === input.targetPortKey &&
    (input.connectionTypeId
      ? connection.connectionTypeId === input.connectionTypeId
      : connection.connectionTypeId === null && connection.type === (input.type ?? "data"))
  );
}

function getConnectionEndpointKey(input: {
  sourceCardId: string;
  targetCardId: string;
  sourcePortKey: string;
  targetPortKey: string;
  connectionTypeId?: string | null;
  type?: string;
}): string {
  return [
    input.sourceCardId,
    input.sourcePortKey,
    input.targetCardId,
    input.targetPortKey,
    input.connectionTypeId ?? `legacy:${input.type ?? "data"}`,
  ].join("::");
}

function clampCardSize(size: V2Card["size"]): V2Card["size"] {
  return {
    width: Math.max(size.width, V2_CARD_MIN_SIZE.width),
    height: Math.max(size.height, V2_CARD_MIN_SIZE.height),
  };
}

function isCardLocked(card: V2Card): boolean {
  return card.visualStyle?.locked === true;
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
  workspaceId: string,
  attachmentCount = 0
): V2CardNode {
  const size = clampCardSize(card.size);

  return {
    id: card.id,
    type: "v2Card",
    position: { x: card.position.x, y: card.position.y },
    draggable: !isCardLocked(card),
    data: {
      card: {
        ...card,
        size,
      },
      cardType: cardTypeMap.get(card.cardTypeId) ?? fallbackCardType(card, workspaceId),
      attachmentCount,
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

export function V2BoardCanvas({
  boardDetail,
  initialCalculationEvaluation,
  onSaveStatusChange
}: Props) {
  const {
    board,
    cards,
    connections,
    cardAttachmentCounts: initialCardAttachmentCounts,
    cardTypes: initialCardTypes,
    connectionTypes: initialConnectionTypes,
  } = boardDetail;
  const [cardTypes, setCardTypes] = useState<V2CardType[]>(initialCardTypes);
  const [connectionTypes, setConnectionTypes] = useState<V2ConnectionType[]>(initialConnectionTypes);
  const [calculationEvaluation, setCalculationEvaluation] =
    useState<V2CalculationEvaluation | null>(initialCalculationEvaluation);
  const [calculationLoading, setCalculationLoading] = useState(
    initialCalculationEvaluation === null
  );
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [calculationRefreshNonce, setCalculationRefreshNonce] = useState(0);
  const [activeConnectionTypeId, setActiveConnectionTypeId] = useState<string | null>(null);
  const [connectionTypePreferenceLoaded, setConnectionTypePreferenceLoaded] = useState(false);
  const cardTypeMap = useMemo(() => buildCardTypeMap(cardTypes), [cardTypes]);
  const connectionTypeMap = useMemo(
    () => new Map(connectionTypes.map((connectionType) => [connectionType.id, connectionType])),
    [connectionTypes]
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [onSaveStatusChange, saveStatus]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [inspectedCardId, setInspectedCardId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [inspectedConnectionId, setInspectedConnectionId] = useState<string | null>(null);
  const [pendingCardAction, setPendingCardAction] = useState<PendingCardAction>(null);
  const [cardActionError, setCardActionError] = useState<CardActionError>(null);
  const [connectionCreateError, setConnectionCreateError] = useState<string | null>(null);
  const [movementSaveError, setMovementSaveError] = useState<string | null>(null);
  const [editorCommandError, setEditorCommandError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<V2DryRunResult | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [isDryRunRunning, setIsDryRunRunning] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCardTypeManagerOpen, setIsCardTypeManagerOpen] = useState(false);
  const [cardTypeManagerInitialId, setCardTypeManagerInitialId] = useState<string | null>(null);
  const [isConnectionTypeManagerOpen, setIsConnectionTypeManagerOpen] = useState(false);
  const [connectionTypeManagerInitialId, setConnectionTypeManagerInitialId] = useState<string | null>(null);
  const [connectionTypeManagerNewTypeSeed, setConnectionTypeManagerNewTypeSeed] =
    useState<V2NewConnectionTypeSeed | null>(null);
  const [connectionTypeManagerSourceConnectionId, setConnectionTypeManagerSourceConnectionId] =
    useState<string | null>(null);
  const [linkedFieldBindings, setLinkedFieldBindings] = useState<V2LinkedFieldBinding[]>([]);
  const [linkedFieldBindingsError, setLinkedFieldBindingsError] = useState<string | null>(null);
  const [linkedFieldBindingsLoading, setLinkedFieldBindingsLoading] = useState(false);
  const cardActionLockRef = useRef<PendingCardAction>(null);
  const selectedCardIdsRef = useRef(selectedCardIds);
  const pendingCardSelectionRef = useRef<string[] | null>(null);
  const lastInteractedCardIdRef = useRef<string | null>(null);
  const groupDragSnapshotRef = useRef<GroupDragSnapshot | null>(null);
  const clipboardRef = useRef<V2ClipboardPayload | null>(null);
  const clipboardPasteCountRef = useRef(0);
  const clipboardPasteBlockedRef = useRef(false);
  const undoStackRef = useRef<V2EditorCommand[]>([]);
  const redoStackRef = useRef<V2EditorCommand[]>([]);
  const commandRunningRef = useRef(false);

  // ── Visual edit mode (state only — handlers below useNodesState) ──
  const [visualEditingCardId, setVisualEditingCardId] = useState<string | null>(null);
  const [visualEditingConnectionId, setVisualEditingConnectionId] = useState<string | null>(null);
  const ignoreNextPaneClickRef = useRef(false);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: V2CardNode[] = cards.map((card: V2Card) =>
      buildCardNode(
        card,
        cardTypeMap,
        board.workspaceId,
        initialCardAttachmentCounts[card.id] ?? 0
      )
    );

    const edges: Edge[] = connections.map((conn: V2Connection) =>
      buildConnectionEdge(
        conn,
        conn.connectionTypeId ? connectionTypeMap.get(conn.connectionTypeId) : null
      )
    );

    return { nodes, edges };
  }, [
    cards,
    connections,
    cardTypeMap,
    connectionTypeMap,
    board.workspaceId,
    initialCardAttachmentCounts
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [connectionRecords, setConnectionRecords] = useState<V2Connection[]>(connections);
  const [attachmentCountsByCardId, setAttachmentCountsByCardId] = useState(
    () => new Map(Object.entries(initialCardAttachmentCounts))
  );
  const [cardAttachmentsByCardId, setCardAttachmentsByCardId] = useState(
    () => new Map<string, V2CardAttachment[]>()
  );
  const [attachmentLoadingCardIds, setAttachmentLoadingCardIds] = useState(
    () => new Set<string>()
  );
  const [previewedAttachment, setPreviewedAttachment] = useState<{
    cardId: string;
    attachmentId: string;
  } | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const connectionRecordsRef = useRef(connectionRecords);
  const pendingConnectionKeysRef = useRef(new Set<string>());
  const cardAttachmentsCacheRef = useRef(cardAttachmentsByCardId);
  const attachmentRequestsRef = useRef(new Map<string, Promise<V2CardAttachment[]>>());

  useEffect(() => {
    const connectionById = new Map(
      connectionRecords.map((connection) => [connection.id, connection])
    );
    setEdges((current) =>
      current.map((edge) => {
        const connection = connectionById.get(edge.id);
        if (!connection) return edge;
        const connectionType = connection.connectionTypeId
          ? connectionTypeMap.get(connection.connectionTypeId) ?? null
          : null;
        return applyConnectionToEdge(edge, connection, connectionType);
      })
    );
  }, [connectionRecords, connectionTypeMap, setEdges]);

  const handleAttachmentsChange = useCallback(
    (cardId: string, attachments: V2CardAttachment[]) => {
      const nextCache = new Map(cardAttachmentsCacheRef.current);
      nextCache.set(cardId, attachments);
      cardAttachmentsCacheRef.current = nextCache;
      setCardAttachmentsByCardId(nextCache);
      setAttachmentCountsByCardId((current) => {
        const next = new Map(current);
        next.set(cardId, attachments.length);
        return next;
      });
      setPreviewedAttachment((current) =>
        current?.cardId === cardId &&
        !attachments.some((attachment) => attachment.id === current.attachmentId)
          ? null
          : current
      );
    },
    []
  );

  const loadCardAttachments = useCallback(
    (cardId: string): Promise<V2CardAttachment[]> => {
      const cached = cardAttachmentsCacheRef.current.get(cardId);
      if (cached) return Promise.resolve(cached);
      const pending = attachmentRequestsRef.current.get(cardId);
      if (pending) return pending;

      setAttachmentLoadingCardIds((current) => new Set(current).add(cardId));
      const request = listV2CardAttachments(cardId)
        .then((attachments) => {
          handleAttachmentsChange(cardId, attachments);
          return attachments;
        })
        .finally(() => {
          attachmentRequestsRef.current.delete(cardId);
          setAttachmentLoadingCardIds((current) => {
            const next = new Set(current);
            next.delete(cardId);
            return next;
          });
        });
      attachmentRequestsRef.current.set(cardId, request);
      return request;
    },
    [handleAttachmentsChange]
  );

  const handleOpenAttachment = useCallback(
    async (cardId: string, attachmentId: string) => {
      const attachments = await loadCardAttachments(cardId);
      if (attachments.some((attachment) => attachment.id === attachmentId)) {
        setPreviewedAttachment({ cardId, attachmentId });
      }
    },
    [loadCardAttachments]
  );

  const clearCardSelection = useCallback(() => {
    pendingCardSelectionRef.current = selectedCardIdsRef.current.length > 0 ? [] : null;
    selectedCardIdsRef.current = [];
    setSelectedCardIds([]);
    setSelectedCardId(null);
    setInspectedCardId(null);
  }, []);

  const selectOnlyCard = useCallback((cardId: string) => {
    pendingCardSelectionRef.current =
      selectedCardIdsRef.current.length === 1 && selectedCardIdsRef.current[0] === cardId
        ? null
        : [cardId];
    selectedCardIdsRef.current = [cardId];
    setSelectedCardIds([cardId]);
    setSelectedCardId(cardId);
    setInspectedConnectionId(null);
  }, []);

  const selectCards = useCallback((cardIds: string[]) => {
    pendingCardSelectionRef.current =
      selectedCardIdsRef.current.length === cardIds.length &&
      selectedCardIdsRef.current.every((id, index) => id === cardIds[index])
        ? null
        : cardIds;
    selectedCardIdsRef.current = cardIds;
    setSelectedCardIds(cardIds);
    setSelectedCardId(cardIds.at(-1) ?? null);
    setInspectedCardId(null);
    setSelectedConnectionId(null);
    setInspectedConnectionId(null);
    setVisualEditingCardId(null);
    setVisualEditingConnectionId(null);
  }, []);

  const runEditorCommand = useCallback(
    async (command: V2EditorCommand): Promise<boolean> => {
      if (commandRunningRef.current) return false;
      commandRunningRef.current = true;
      setEditorCommandError(null);
      try {
        await command.execute();
        redoStackRef.current = [];
        if (command.undo) {
          undoStackRef.current = [...undoStackRef.current, command].slice(-V2_HISTORY_LIMIT);
        }
        return true;
      } catch (error) {
        setEditorCommandError(
          error instanceof Error ? error.message : `${command.label} failed.`
        );
        return false;
      } finally {
        commandRunningRef.current = false;
      }
    },
    []
  );

  const clearEditorHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, []);

  const undoLastCommand = useCallback(async (): Promise<boolean> => {
    if (commandRunningRef.current) return false;
    const command = undoStackRef.current.at(-1);
    if (!command?.undo) return false;
    commandRunningRef.current = true;
    setEditorCommandError(null);
    try {
      await command.undo();
      undoStackRef.current = undoStackRef.current.slice(0, -1);
      redoStackRef.current = [...redoStackRef.current, command].slice(-V2_HISTORY_LIMIT);
      return true;
    } catch (error) {
      setEditorCommandError(
        error instanceof Error ? error.message : `Could not undo ${command.label.toLowerCase()}.`
      );
      return false;
    } finally {
      commandRunningRef.current = false;
    }
  }, []);

  const redoLastCommand = useCallback(async (): Promise<boolean> => {
    if (commandRunningRef.current) return false;
    const command = redoStackRef.current.at(-1);
    if (!command) return false;
    commandRunningRef.current = true;
    setEditorCommandError(null);
    try {
      await command.execute();
      redoStackRef.current = redoStackRef.current.slice(0, -1);
      undoStackRef.current = [...undoStackRef.current, command].slice(-V2_HISTORY_LIMIT);
      return true;
    } catch (error) {
      setEditorCommandError(
        error instanceof Error ? error.message : `Could not redo ${command.label.toLowerCase()}.`
      );
      return false;
    } finally {
      commandRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    selectedCardIdsRef.current = selectedCardIds;
    const selectedIds = new Set(selectedCardIds);
    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        const selected = selectedIds.has(node.id);
        if (node.selected === selected) return node;
        changed = true;
        return { ...node, selected };
      });
      return changed ? next : current;
    });
  }, [selectedCardIds, setNodes]);

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
  const inspectedNode = useMemo(
    () => nodes.find((node) => node.id === inspectedCardId) ?? null,
    [inspectedCardId, nodes]
  );
  const inspectedCard = inspectedNode?.data.card ?? null;
  const inspectedCardAttachments = inspectedCard
    ? cardAttachmentsByCardId.get(inspectedCard.id)
    : undefined;
  const inspectedCardType = inspectedNode?.data.cardType ?? (
    inspectedCard ? cardTypeMap.get(inspectedCard.cardTypeId) ?? null : null
  );
  const incomingConnections = useMemo(
    () =>
      inspectedCard
        ? connectionRecords.filter((connection) => connection.targetCardId === inspectedCard.id)
        : [],
    [connectionRecords, inspectedCard]
  );
  const outgoingConnections = useMemo(
    () =>
      inspectedCard
        ? connectionRecords.filter((connection) => connection.sourceCardId === inspectedCard.id)
        : [],
    [connectionRecords, inspectedCard]
  );
  const selectedConnection = useMemo(
    () => connectionRecords.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connectionRecords, selectedConnectionId]
  );
  const inspectedConnection = useMemo(
    () => connectionRecords.find((connection) => connection.id === inspectedConnectionId) ?? null,
    [connectionRecords, inspectedConnectionId]
  );
  const inspectedConnectionType = useMemo<V2ConnectionType | null>(() => {
    if (!inspectedConnection) return null;
    return (
      connectionTypes.find((connectionType) => connectionType.id === inspectedConnection.connectionTypeId) ??
      connectionTypes.find((connectionType) => connectionType.key === "generic") ??
      null
    );
  }, [connectionTypes, inspectedConnection]);
  const previewAttachments = previewedAttachment
    ? cardAttachmentsByCardId.get(previewedAttachment.cardId) ?? []
    : [];
  const previewAttachmentIndex = previewedAttachment
    ? previewAttachments.findIndex(
        (attachment) => attachment.id === previewedAttachment.attachmentId
      )
    : -1;
  const activeConnectionType = useMemo(
    () =>
      connectionTypes.find((connectionType) => connectionType.id === activeConnectionTypeId) ??
      connectionTypes.find((connectionType) => connectionType.key === "generic") ??
      connectionTypes[0] ??
      null,
    [activeConnectionTypeId, connectionTypes]
  );

  useEffect(() => {
    let storedConnectionTypeId: string | null = null;
    try {
      storedConnectionTypeId = window.localStorage.getItem(
        `yadraw:v2:board:${board.id}:connection-type`
      );
    } catch {
      // Browser storage can be unavailable in restricted contexts.
    }
    setActiveConnectionTypeId(storedConnectionTypeId);
    setConnectionTypePreferenceLoaded(true);
  }, [board.id]);

  useEffect(() => {
    if (
      !connectionTypePreferenceLoaded ||
      !activeConnectionType ||
      activeConnectionType.id === activeConnectionTypeId
    ) {
      return;
    }
    setActiveConnectionTypeId(activeConnectionType.id);
  }, [activeConnectionType, activeConnectionTypeId, connectionTypePreferenceLoaded]);

  const handleSelectConnectionType = useCallback(
    (connectionTypeId: string) => {
      setActiveConnectionTypeId(connectionTypeId);
      window.localStorage.setItem(`yadraw:v2:board:${board.id}:connection-type`, connectionTypeId);
    },
    [board.id]
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
  const calculationInputSignature = useMemo(
    () =>
      JSON.stringify({
        cards: boardCardPreviewSignature,
        connections: connectionRecords.map((connection) => ({
          id: connection.id,
          connectionTypeId: connection.connectionTypeId,
          sourceCardId: connection.sourceCardId,
          targetCardId: connection.targetCardId,
          sourcePortKey: connection.sourcePortKey,
          targetPortKey: connection.targetPortKey,
          data: connection.data,
          status: connection.status,
          updatedAt: connection.updatedAt
        })),
        connectionTypes: connectionTypes.map((connectionType) => ({
          id: connectionType.id,
          schema: connectionType.schema,
          updatedAt: connectionType.updatedAt
        })),
        refresh: calculationRefreshNonce
      }),
    [boardCardPreviewSignature, calculationRefreshNonce, connectionRecords, connectionTypes]
  );
  const lastCalculationSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      lastCalculationSignatureRef.current === null &&
      initialCalculationEvaluation !== null
    ) {
      lastCalculationSignatureRef.current = calculationInputSignature;
      return;
    }
    if (lastCalculationSignatureRef.current === calculationInputSignature) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      lastCalculationSignatureRef.current = calculationInputSignature;
      setCalculationLoading(true);
      setCalculationError(null);
      void evaluateV2BoardCalculations(board.id)
        .then((evaluation) => {
          if (!controller.signal.aborted) setCalculationEvaluation(evaluation);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCalculationError("Calculated values are temporarily unavailable.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setCalculationLoading(false);
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [board.id, calculationInputSignature, initialCalculationEvaluation]);
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
    const connectionIds = new Set(connectionRecords.map((connection) => connection.id));
    if (selectedConnectionId && !connectionIds.has(selectedConnectionId)) {
      setSelectedConnectionId(null);
      setVisualEditingConnectionId(null);
    }
    if (inspectedConnectionId && !connectionIds.has(inspectedConnectionId)) {
      setInspectedConnectionId(null);
    }
  }, [connectionRecords, inspectedConnectionId, selectedConnectionId]);

  // ── Visual edit handlers ─────────────────────────────────────────
  const handleResizeCard = useCallback(
    async (cardId: string, size: { width: number; height: number }) => {
      const card = nodesRef.current.find((node) => node.id === cardId)?.data.card;
      if (card && isCardLocked(card)) return;

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

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams<V2CardNode, Edge>) => {
      const pendingCardIds = pendingCardSelectionRef.current;
      pendingCardSelectionRef.current = null;
      const cardIds = pendingCardIds ?? selectedNodes.map((node) => node.id);
      const selectedIdSet = new Set(cardIds);
      const retainedIds = selectedCardIdsRef.current.filter((id) => selectedIdSet.has(id));
      const retainedIdSet = new Set(retainedIds);
      const orderedCardIds = [
        ...retainedIds,
        ...cardIds.filter((id) => !retainedIdSet.has(id)),
      ];
      selectedCardIdsRef.current = orderedCardIds;
      setSelectedCardIds((current) =>
        current.length === orderedCardIds.length &&
        current.every((id, index) => id === orderedCardIds[index])
          ? current
          : orderedCardIds
      );
      setSelectedCardId((current) => {
        const interactedId = lastInteractedCardIdRef.current;
        if (interactedId && selectedIdSet.has(interactedId)) return interactedId;
        if (current && selectedIdSet.has(current)) return current;
        return orderedCardIds.at(-1) ?? null;
      });
      lastInteractedCardIdRef.current = null;
      if (orderedCardIds.length > 0) {
        setSelectedConnectionId(null);
        setInspectedConnectionId(null);
        setVisualEditingConnectionId(null);
        setConnectionCreateError(null);
      }
    },
    []
  );

  const handleNodeClick = useCallback(
    (event: ReactMouseEvent, node: V2CardNode) => {
      lastInteractedCardIdRef.current = node.id;
      if (event.ctrlKey || event.metaKey) {
        const currentCardIds = selectedCardIdsRef.current;
        const nextCardIds = currentCardIds.includes(node.id)
          ? currentCardIds.filter((id) => id !== node.id)
          : [...currentCardIds, node.id];
        pendingCardSelectionRef.current = nextCardIds;
        selectedCardIdsRef.current = nextCardIds;
        setSelectedCardIds(nextCardIds);
        setSelectedCardId((current) => {
          if (nextCardIds.includes(node.id)) return node.id;
          if (current && nextCardIds.includes(current)) return current;
          return nextCardIds.at(-1) ?? null;
        });
      } else {
        selectOnlyCard(node.id);
      }
      setSelectedConnectionId(null);
      setInspectedConnectionId(null);
      setVisualEditingConnectionId(null);
      setConnectionCreateError(null);
      setMovementSaveError(null);
      setInspectedCardId(null);
    },
    [selectOnlyCard]
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
      const touchesPositionLock = Object.prototype.hasOwnProperty.call(patch, "locked");
      const node = nodesRef.current.find((n) => n.id === cardId);
      const current = (node?.data as { card?: { visualStyle?: V2CardVisualStyle } })?.card?.visualStyle ?? {};
      const previousConnectorSlots = current.connectorSlots;
      const previousLocked = current.locked;
      const nextVisualStyle = Object.fromEntries(
        Object.entries({ ...current, ...patch }).filter(([, value]) => value !== undefined && value !== "")
      ) as V2CardVisualStyle;

      // Optimistic local update
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== cardId) return n;
          return {
            ...n,
            draggable: nextVisualStyle.locked !== true,
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
        if (touchesConnectorSlots || touchesPositionLock) {
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
              if (previousLocked === undefined) {
                delete restoredVisualStyle.locked;
              } else {
                restoredVisualStyle.locked = previousLocked;
              }
              return {
                ...n,
                draggable: restoredVisualStyle.locked !== true,
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
        setCalculationRefreshNonce((current) => current + 1);
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
    selectOnlyCard(cardId);
    setInspectedCardId(cardId);
    setSelectedConnectionId(null);
    setVisualEditingCardId(cardId);
    setVisualEditingConnectionId(null);
    setCardActionError(null);
    setConnectionCreateError(null);
  }, [selectOnlyCard]);

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
        selectOnlyCard(created.id);
        setInspectedCardId(null);
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
    [board.workspaceId, cardTypeMap, selectOnlyCard, setNodes]
  );

  const applyDeletedCardIds = useCallback(
    (cardIds: string[], invalidateHistory = false) => {
      const deletedIds = new Set(cardIds);
      if (invalidateHistory) clearEditorHistory();
      groupDragSnapshotRef.current = null;
      setNodes((current) => current.filter((node) => !deletedIds.has(node.id)));
      setEdges((current) =>
        current.filter((edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target))
      );
      setConnectionRecords((current) =>
        current.filter(
          (connection) =>
            !deletedIds.has(connection.sourceCardId) && !deletedIds.has(connection.targetCardId)
        )
      );
      const remainingCardIds = selectedCardIdsRef.current.filter((id) => !deletedIds.has(id));
      selectedCardIdsRef.current = remainingCardIds;
      setSelectedCardIds(remainingCardIds);
      setSelectedCardId((current) =>
        current && deletedIds.has(current) ? remainingCardIds.at(-1) ?? null : current
      );
      setInspectedCardId((current) => (current && deletedIds.has(current) ? null : current));
      setVisualEditingCardId((current) => (current && deletedIds.has(current) ? null : current));
      setSelectedConnectionId(null);
      setInspectedConnectionId(null);
      setVisualEditingConnectionId(null);
    },
    [clearEditorHistory, setEdges, setNodes]
  );

  const deleteCardsByIds = useCallback(
    async (cardIds: string[]) => {
      const results = await Promise.allSettled(cardIds.map((cardId) => deleteV2Card(cardId)));
      const deletedIds = cardIds.filter((_cardId, index) => results[index]?.status === "fulfilled");
      const failedIds = cardIds.filter((_cardId, index) => results[index]?.status === "rejected");
      if (deletedIds.length > 0) applyDeletedCardIds(deletedIds, true);
      if (failedIds.length > 0) {
        throw new Error(
          deletedIds.length > 0
            ? `Deleted ${deletedIds.length} of ${cardIds.length} cards. ${failedIds.length} could not be deleted.`
            : "Selected cards could not be deleted."
        );
      }
    },
    [applyDeletedCardIds]
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
        await deleteCardsByIds([cardId]);
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
    [deleteCardsByIds]
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
          title: "New card",
          description: "",
          data: {},
          position,
          size: clampCardSize(cardType.defaultSize),
        });

        setNodes((current) => [
          ...current,
          buildCardNode(created, cardTypeMap, board.workspaceId),
        ]);
        selectOnlyCard(created.id);
        setInspectedCardId(null);
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
    [board.id, board.workspaceId, cardTypeMap, selectOnlyCard, setNodes]
  );

  const copySelectedCards = useCallback((): boolean => {
    const selectedIds = new Set(selectedCardIdsRef.current);
    const selectedCards = nodesRef.current
      .filter((node) => selectedIds.has(node.id))
      .map((node) => node.data.card);
    if (selectedCards.length === 0) return false;
    clipboardRef.current = buildV2ClipboardPayload(selectedCards);
    clipboardPasteCountRef.current = 0;
    clipboardPasteBlockedRef.current = false;
    setEditorCommandError(null);
    return true;
  }, []);

  const createClipboardCards = useCallback(
    async (clipboardCards: V2ClipboardCard[], offset: number): Promise<V2Card[]> => {
      const results = await Promise.allSettled(
        clipboardCards.map((card) =>
          createV2Card(board.id, {
            cardTypeId: card.cardTypeId,
            title: card.title,
            description: card.description,
            data: structuredClone(card.data),
            position: {
              x: card.position.x + offset,
              y: card.position.y + offset,
            },
            size: { ...card.size },
            visualStyle: structuredClone(card.visualStyle),
          })
        )
      );
      const createdCards = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );
      const failedCount = results.length - createdCards.length;
      if (failedCount > 0) {
        const rollbackResults = await Promise.allSettled(
          createdCards.map((card) => deleteV2Card(card.id))
        );
        const rollbackFailedCards = createdCards.filter(
          (_card, index) => rollbackResults[index]?.status === "rejected"
        );
        if (rollbackFailedCards.length > 0) {
          setNodes((current) => [
            ...current,
            ...rollbackFailedCards.map((card) =>
              buildCardNode(card, cardTypeMap, board.workspaceId)
            ),
          ]);
          selectCards(rollbackFailedCards.map((card) => card.id));
          clipboardPasteBlockedRef.current = true;
          throw new Error(
            `Paste created ${rollbackFailedCards.length} cards that could not be rolled back. Copy again before retrying.`
          );
        }
        throw new Error(`Paste failed for ${failedCount} cards. No pasted cards were kept.`);
      }

      setNodes((current) => [
        ...current,
        ...createdCards.map((card) => buildCardNode(card, cardTypeMap, board.workspaceId)),
      ]);
      selectCards(createdCards.map((card) => card.id));
      return createdCards;
    },
    [board.id, board.workspaceId, cardTypeMap, selectCards, setNodes]
  );

  const pasteClipboardCards = useCallback(async (): Promise<boolean> => {
    const payload = clipboardRef.current;
    if (!payload || payload.cards.length === 0) return false;
    if (clipboardPasteBlockedRef.current) {
      setEditorCommandError("Paste is blocked after a partial failure. Copy again before retrying.");
      return false;
    }

    const pasteIndex = clipboardPasteCountRef.current + 1;
    const offset = V2_PASTE_OFFSET * pasteIndex;
    let createdCardIds: string[] = [];
    const command: V2EditorCommand = {
      label: "Paste",
      execute: async () => {
        if (clipboardPasteBlockedRef.current) {
          throw new Error("Paste is blocked after a partial failure. Copy again before retrying.");
        }
        setSaveStatus("saving");
        try {
          const createdCards = await createClipboardCards(payload.cards, offset);
          createdCardIds = createdCards.map((card) => card.id);
          setSaveStatus("saved");
        } catch (error) {
          setSaveStatus("error");
          throw error;
        }
      },
      undo: async () => {
        setSaveStatus("saving");
        const results = await Promise.allSettled(
          createdCardIds.map((cardId) => deleteV2Card(cardId))
        );
        const deletedIds = createdCardIds.filter(
          (_cardId, index) => results[index]?.status === "fulfilled"
        );
        const failedIds = createdCardIds.filter(
          (_cardId, index) => results[index]?.status === "rejected"
        );
        if (deletedIds.length > 0) applyDeletedCardIds(deletedIds);
        createdCardIds = failedIds;
        if (failedIds.length > 0) {
          setSaveStatus("error");
          throw new Error(`Could not undo paste for ${failedIds.length} cards.`);
        }
        setSaveStatus("saved");
      },
    };
    const succeeded = await runEditorCommand(command);
    if (succeeded) clipboardPasteCountRef.current = pasteIndex;
    return succeeded;
  }, [applyDeletedCardIds, createClipboardCards, runEditorCommand]);

  const deleteSelectedCards = useCallback(async (): Promise<boolean> => {
    const cardIds = [...selectedCardIdsRef.current];
    if (cardIds.length === 0) return false;
    const selectedIds = new Set(cardIds);
    const connectedCount = connectionRecordsRef.current.filter(
      (connection) =>
        selectedIds.has(connection.sourceCardId) || selectedIds.has(connection.targetCardId)
    ).length;
    const connectorWarning =
      connectedCount > 0
        ? ` ${connectedCount} connected connector${connectedCount === 1 ? "" : "s"} will also be removed.`
        : "";
    if (
      !window.confirm(
        `Delete ${cardIds.length} selected card${cardIds.length === 1 ? "" : "s"}?${connectorWarning} Files will stay in storage.`
      )
    ) {
      return false;
    }

    setSaveStatus("saving");
    const succeeded = await runEditorCommand({
      label: "Delete cards",
      execute: () => deleteCardsByIds(cardIds),
    });
    setSaveStatus(succeeded ? "saved" : "error");
    return succeeded;
  }, [deleteCardsByIds, runEditorCommand]);

  const cutSelectedCards = useCallback(async (): Promise<boolean> => {
    if (!copySelectedCards()) return false;
    return deleteSelectedCards();
  }, [copySelectedCards, deleteSelectedCards]);

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
    setConnectionTypeManagerNewTypeSeed(null);
    setConnectionTypeManagerSourceConnectionId(null);
    setConnectionTypeManagerInitialId(connectionTypeId ?? null);
    setIsConnectionTypeManagerOpen(true);
  }, []);

  const handleCreateTypeFromConnection = useCallback(
    (connectionId: string, seed: V2NewConnectionTypeSeed) => {
      setConnectionTypeManagerInitialId(null);
      setConnectionTypeManagerNewTypeSeed(seed);
      setConnectionTypeManagerSourceConnectionId(connectionId);
      setIsConnectionTypeManagerOpen(true);
    },
    []
  );

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

  const handleDeleteCardType = useCallback(
    async (cardTypeId: string) => {
      setSaveStatus("saving");
      try {
        await deleteV2CardType(board.id, cardTypeId);
        setCardTypes((current) => current.filter((cardType) => cardType.id !== cardTypeId));
        setSaveStatus("saved");
      } catch (error) {
        console.error("Failed to delete card type:", error);
        setSaveStatus("error");
        throw error;
      }
    },
    [board.id]
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
          attachmentCount: attachmentCountsByCardId.get(node.id) ?? 0,
          attachments: cardAttachmentsByCardId.get(node.id),
          attachmentsLoading: attachmentLoadingCardIds.has(node.id),
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
          onLoadAttachments: loadCardAttachments,
          onOpenAttachment: handleOpenAttachment,
        },
      }))
    );
  }, [
    setNodes,
    boardCardPreviewSignature,
    cardTypes,
    linkedFieldBindings,
    attachmentCountsByCardId,
    cardAttachmentsByCardId,
    attachmentLoadingCardIds,
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
    loadCardAttachments,
    handleOpenAttachment,
  ]);

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
      const previous = connectionRecordsRef.current.find(
        (connection) => connection.id === connectionId
      );
      if (!previous) return;
      const selectedConnectionType =
        patch.connectionTypeId !== undefined && patch.connectionTypeId !== null
          ? connectionTypes.find((connectionType) => connectionType.id === patch.connectionTypeId) ?? null
          : null;
      const effectivePatch =
        selectedConnectionType && patch.visualStyle === undefined
          ? {
              ...patch,
              visualStyle: applyConnectionTypeStyle(previous.visualStyle, selectedConnectionType),
            }
          : patch;
      const optimistic: V2Connection = {
        ...previous,
        ...(effectivePatch.title !== undefined ? { title: effectivePatch.title?.trim() || null } : {}),
        ...(effectivePatch.description !== undefined ? { description: effectivePatch.description ?? null } : {}),
        ...(effectivePatch.connectionTypeId !== undefined ? { connectionTypeId: effectivePatch.connectionTypeId } : {}),
        ...(effectivePatch.sourceCardId !== undefined ? { sourceCardId: effectivePatch.sourceCardId } : {}),
        ...(effectivePatch.targetCardId !== undefined ? { targetCardId: effectivePatch.targetCardId } : {}),
        ...(effectivePatch.sourcePortKey !== undefined ? { sourcePortKey: effectivePatch.sourcePortKey } : {}),
        ...(effectivePatch.targetPortKey !== undefined ? { targetPortKey: effectivePatch.targetPortKey } : {}),
        ...(effectivePatch.data !== undefined ? { data: effectivePatch.data } : {}),
        ...(effectivePatch.visualStyle !== undefined
          ? { visualStyle: { ...previous.visualStyle, ...effectivePatch.visualStyle } }
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
        const updated = await updateV2Connection(connectionId, effectivePatch);
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
    [connectionTypes, setEdges]
  );

  const handleCreateConnectionTypeFromManager = useCallback(
    async (input: Parameters<typeof createV2ConnectionType>[1]) => {
      const created = await handleCreateConnectionType(input);
      const sourceConnectionId = connectionTypeManagerSourceConnectionId;
      setConnectionTypeManagerSourceConnectionId(null);
      if (sourceConnectionId) {
        try {
          await handleUpdateConnection(sourceConnectionId, {
            connectionTypeId: created.id,
          });
        } catch (error) {
          console.error("Failed to assign the new connector type:", error);
        }
      }
      return created;
    },
    [connectionTypeManagerSourceConnectionId, handleCreateConnectionType, handleUpdateConnection]
  );

  const applyMovement = useCallback(
    async (
      positions: CardPositionUpdate[],
      connectionStyles: ConnectionVisualStyleUpdate[]
    ) => {
      const previousPositions = new Map(
        nodesRef.current
          .filter((node) => positions.some((update) => update.cardId === node.id))
          .map((node) => [node.id, { ...node.data.card.position }])
      );
      const previousConnections = new Map(
        connectionRecordsRef.current
          .filter((connection) =>
            connectionStyles.some((update) => update.connectionId === connection.id)
          )
          .map((connection) => [connection.id, connection])
      );
      const positionById = new Map(
        positions.map(({ cardId, position }) => [cardId, position])
      );
      setNodes((current) => {
        let changed = false;
        const next = current.map((currentNode) => {
          const position = positionById.get(currentNode.id);
          if (!position) return currentNode;
          if (
            currentNode.position.x === position.x &&
            currentNode.position.y === position.y &&
            currentNode.data.card.position.x === position.x &&
            currentNode.data.card.position.y === position.y
          ) {
            return currentNode;
          }
          changed = true;
          return {
            ...currentNode,
            position,
            data: {
              ...currentNode.data,
              card: {
                ...currentNode.data.card,
                position,
              },
            },
          };
        });
        return changed ? next : current;
      });
      const visualStyleById = new Map(
        connectionStyles.map(({ connectionId, visualStyle }) => [connectionId, visualStyle])
      );
      setConnectionRecords((current) =>
        current.map((connection) => {
          const visualStyle = visualStyleById.get(connection.id);
          return visualStyle ? { ...connection, visualStyle } : connection;
        })
      );
      setEdges((current) =>
        current.map((edge) => {
          const visualStyle = visualStyleById.get(edge.id);
          const connection = connectionRecordsRef.current.find((item) => item.id === edge.id);
          return visualStyle && connection
            ? applyConnectionToEdge(edge, { ...connection, visualStyle })
            : edge;
        })
      );
      setSaveStatus("saving");
      try {
        await updateV2BoardLayout(board.id, {
          cards: positions.map(({ cardId, position }) => ({ id: cardId, position })),
          connections: connectionStyles.map(({ connectionId, visualStyle }) => ({
            id: connectionId,
            visualStyle
          }))
        });
        setMovementSaveError(null);
        setSaveStatus("saved");
      } catch (error) {
        setNodes((current) =>
          current.map((node) => {
            const position = previousPositions.get(node.id);
            return position
              ? { ...node, position, data: { ...node.data, card: { ...node.data.card, position } } }
              : node;
          })
        );
        setConnectionRecords((current) =>
          current.map((connection) => previousConnections.get(connection.id) ?? connection)
        );
        setEdges((current) =>
          current.map((edge) => {
            const connection = previousConnections.get(edge.id);
            return connection ? applyConnectionToEdge(edge, connection) : edge;
          })
        );
        setMovementSaveError(
          "Movement could not be saved. The previous layout was restored."
        );
        setSaveStatus("error");
        throw error;
      }
    },
    [board.id, setEdges, setNodes]
  );

  const handleNodeDragStart = useCallback<OnNodeDrag<V2CardNode>>(
    (_event, node, draggedNodes) => {
      const movingNodes = (draggedNodes.length > 0 ? draggedNodes : [node]).filter(
        (movingNode) => !isCardLocked(movingNode.data.card)
      );
      if (movingNodes.length === 0 || isCardLocked(node.data.card)) {
        groupDragSnapshotRef.current = null;
        return;
      }
      const movedCardIds = new Set(movingNodes.map((movingNode) => movingNode.id));
      groupDragSnapshotRef.current = {
        draggedNodeId: node.id,
        positions: new Map(
          movingNodes.map((movingNode) => [
            movingNode.id,
            { x: movingNode.position.x, y: movingNode.position.y },
          ])
        ),
        manualConnections: connectionRecordsRef.current.filter(
          (connection) =>
            connection.visualStyle.routeMode === "manual" &&
            movedCardIds.has(connection.sourceCardId) &&
            movedCardIds.has(connection.targetCardId)
        ),
      };
      lastInteractedCardIdRef.current = node.id;
      setSelectedCardId(node.id);
      setSelectedConnectionId(null);
      setInspectedConnectionId(null);
      setVisualEditingConnectionId(null);
      setConnectionCreateError(null);
    },
    []
  );

  const handleNodeDrag = useCallback<OnNodeDrag<V2CardNode>>(
    (_event, node) => {
      const snapshot = groupDragSnapshotRef.current;
      const draggedStart = snapshot?.positions.get(node.id);
      if (!snapshot || snapshot.draggedNodeId !== node.id || !draggedStart) return;

      const delta = {
        x: node.position.x - draggedStart.x,
        y: node.position.y - draggedStart.y,
      };
      const movedCardIds = new Set(snapshot.positions.keys());
      const translatedById = new Map(
        snapshot.manualConnections.flatMap((connection) => {
          const visualStyle = translateInternalManualRoute(connection, movedCardIds, delta);
          return visualStyle ? [[connection.id, { ...connection, visualStyle }] as const] : [];
        })
      );
      if (translatedById.size === 0) return;

      setConnectionRecords((current) => {
        const next = current.map((connection) => translatedById.get(connection.id) ?? connection);
        connectionRecordsRef.current = next;
        return next;
      });
      setEdges((current) =>
        current.map((edge) => {
          const translated = translatedById.get(edge.id);
          return translated ? applyConnectionToEdge(edge, translated) : edge;
        })
      );
    },
    [setEdges]
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<V2CardNode>>(
    (_event, node, draggedNodes) => {
      const snapshot = groupDragSnapshotRef.current;
      if (!snapshot || snapshot.draggedNodeId !== node.id) return;
      groupDragSnapshotRef.current = null;

      const draggedStart = snapshot.positions.get(node.id);
      if (!draggedStart) return;
      const delta = {
        x: node.position.x - draggedStart.x,
        y: node.position.y - draggedStart.y,
      };
      if (delta.x === 0 && delta.y === 0) return;

      const finalPositionById = new Map(
        draggedNodes.map((draggedNode) => [
          draggedNode.id,
          { x: draggedNode.position.x, y: draggedNode.position.y },
        ])
      );
      const movedCardIds = new Set(snapshot.positions.keys());
      const movedPositions = Array.from(snapshot.positions, ([cardId, start]) => ({
        cardId,
        position: finalPositionById.get(cardId) ?? {
          x: start.x + delta.x,
          y: start.y + delta.y,
        },
      }));
      const previousPositions = Array.from(snapshot.positions, ([cardId, position]) => ({
        cardId,
        position,
      }));
      const manualRouteUpdates: ConnectionVisualStyleUpdate[] = snapshot.manualConnections.flatMap((connection) => {
        const visualStyle = translateInternalManualRoute(connection, movedCardIds, delta);
        return visualStyle ? [{ connectionId: connection.id, visualStyle }] : [];
      });
      const previousManualRouteStyles: ConnectionVisualStyleUpdate[] =
        snapshot.manualConnections.map((connection) => ({
          connectionId: connection.id,
          visualStyle: connection.visualStyle,
        }));

      const movementCommand: V2EditorCommand = {
        label: "Move cards",
        execute: () => applyMovement(movedPositions, manualRouteUpdates),
        undo: () => applyMovement(previousPositions, previousManualRouteStyles),
      };
      if (commandRunningRef.current) {
        void applyMovement(movedPositions, manualRouteUpdates).catch((error) => {
          console.error("Failed to save grouped card positions:", error);
        });
        return;
      }
      void runEditorCommand(movementCommand);
    },
    [applyMovement, runEditorCommand]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<V2CardNode>[]) => {
      const lockedCardIds = new Set(
        nodesRef.current
          .filter((node) => isCardLocked(node.data.card))
          .map((node) => node.id)
      );
      onNodesChange(
        changes.filter(
          (change) => change.type !== "position" || !lockedCardIds.has(change.id)
        )
      );
    },
    [onNodesChange]
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

  const deleteConnectionById = useCallback(
    async (connectionId: string) => {
      setSaveStatus("saving");
      setConnectionCreateError(null);
      await deleteV2Connection(connectionId);
      setConnectionRecords((current) => current.filter((item) => item.id !== connectionId));
      setEdges((current) => current.filter((edge) => edge.id !== connectionId));
      setSelectedConnectionId((current) => (current === connectionId ? null : current));
      setInspectedConnectionId((current) => (current === connectionId ? null : current));
      setVisualEditingConnectionId((current) => (current === connectionId ? null : current));
      clearEditorHistory();
      setSaveStatus("saved");
    },
    [clearEditorHistory, setEdges]
  );

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      const connection = connectionRecordsRef.current.find((item) => item.id === connectionId);
      if (!connection) return;
      if (!window.confirm("Delete this connector? Cards and files will stay unchanged.")) {
        return;
      }

      try {
        await deleteConnectionById(connectionId);
      } catch (err) {
        console.error("Failed to delete connection:", err);
        setConnectionCreateError("Connector could not be deleted.");
        setSaveStatus("error");
        throw err;
      }
    },
    [deleteConnectionById]
  );

  const handleSelectConnection = useCallback(
    (connectionId: string) => {
      setSelectedConnectionId(connectionId);
      clearCardSelection();
      setVisualEditingCardId(null);
      setInspectedConnectionId(null);
      setVisualEditingConnectionId(null);
      setCardActionError(null);
      setConnectionCreateError(null);
    },
    [clearCardSelection]
  );

  const handleEdgeClick = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      event.stopPropagation();
      handleSelectConnection(edge.id);
    },
    [handleSelectConnection]
  );

  const handleOpenConnectionEditor = useCallback(
    (connectionId: string) => {
      setSelectedConnectionId(connectionId);
      clearCardSelection();
      setVisualEditingCardId(null);
      setInspectedConnectionId(connectionId);
      setVisualEditingConnectionId(connectionId);
      setCardActionError(null);
      setConnectionCreateError(null);
    },
    [clearCardSelection]
  );

  const handleEdgeDoubleClick = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      event.stopPropagation();
      handleOpenConnectionEditor(edge.id);
    },
    [handleOpenConnectionEditor]
  );

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
        connectionTypeId: activeConnectionType?.id ?? null,
        type: "data",
        label: connectionInput.sourcePortKey,
        data: buildV2ConnectionDefaultData(activeConnectionType),
        visualStyle: activeConnectionType?.defaultVisualStyle ?? {},
      };
      const duplicate = connectionRecordsRef.current.find((record) =>
        isSameConnectionEndpoint(record, createInput)
      );
      if (duplicate) {
        setSelectedConnectionId(duplicate.id);
        clearCardSelection();
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
        const newEdge: Edge = buildConnectionEdge(created, activeConnectionType);
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
    [activeConnectionType, board.id, cardTypeMap, clearCardSelection, setEdges]
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
        clearCardSelection();
        setConnectionCreateError("Connection already exists.");
        setSaveStatus("error");
        return;
      }

      setConnectionCreateError(null);
      try {
        await handleUpdateConnection(existing.id, endpointPatch);
        setSelectedConnectionId(existing.id);
        clearCardSelection();
      } catch (err) {
        console.error("Failed to retarget connection:", err);
        setConnectionCreateError(
          err instanceof V2ApiError && err.status === 409
            ? "Connection already exists."
            : "Connector could not be retargeted."
        );
      }
    },
    [cardTypeMap, clearCardSelection, handleUpdateConnection]
  );

  // ── Delete connection ────────────────────────────────────────────
  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (deletedEdges.length > 0) clearEditorHistory();
      void Promise.allSettled(deletedEdges.map((edge) => deleteV2Connection(edge.id))).then(
        (results) => {
          const deletedIds = new Set(
            deletedEdges
              .filter((_edge, index) => results[index]?.status === "fulfilled")
              .map((edge) => edge.id)
          );
          const failedEdges = deletedEdges.filter(
            (_edge, index) => results[index]?.status === "rejected"
          );
          setConnectionRecords((current) =>
            current.filter((connection) => !deletedIds.has(connection.id))
          );
          if (failedEdges.length > 0) {
            setEdges((current) => [
              ...current,
              ...failedEdges.filter((edge) => !current.some((item) => item.id === edge.id)),
            ]);
            setConnectionCreateError(
              `${failedEdges.length} connector${failedEdges.length === 1 ? "" : "s"} could not be deleted and were restored.`
            );
          } else {
            setConnectionCreateError(null);
          }
          setSelectedConnectionId((current) =>
            current && deletedIds.has(current) ? null : current
          );
          setVisualEditingConnectionId((current) =>
            current && deletedIds.has(current) ? null : current
          );
        }
      );
    },
    [clearEditorHistory, setEdges]
  );

  const deleteSelectedConnection = useCallback(async (): Promise<boolean> => {
    const connectionId = selectedConnectionId;
    if (!connectionId) return false;
    if (!window.confirm("Delete this connector? Cards and files will stay unchanged.")) {
      return false;
    }

    const succeeded = await runEditorCommand({
      label: "Delete connector",
      execute: () => deleteConnectionById(connectionId),
    });
    if (!succeeded) setSaveStatus("error");
    return succeeded;
  }, [deleteConnectionById, runEditorCommand, selectedConnectionId]);

  const shortcutsBlocked = Boolean(
    inspectedCardId ||
      inspectedConnectionId ||
      visualEditingCardId ||
      visualEditingConnectionId ||
      isCardTypeManagerOpen ||
      isConnectionTypeManagerOpen ||
      isAssistantOpen ||
      dryRunResult
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        shortcutsBlocked ||
        commandRunningRef.current ||
        isEditableShortcutTarget(event.target) ||
        document.querySelector("[role='dialog'], [aria-modal='true']")
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const selectedCardsAvailable = selectedCardIdsRef.current.length > 0;

      if (
        key === "delete" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (selectedCardsAvailable || selectedConnectionId)
      ) {
        event.preventDefault();
        if (selectedCardsAvailable) {
          void deleteSelectedCards();
        } else {
          void deleteSelectedConnection();
        }
        return;
      }

      if (!modifier || event.altKey) return;

      if (key === "c" && !event.shiftKey && selectedCardsAvailable) {
        if (copySelectedCards()) event.preventDefault();
        return;
      }

      if (
        key === "v" &&
        !event.shiftKey &&
        clipboardRef.current &&
        clipboardRef.current.cards.length > 0
      ) {
        event.preventDefault();
        void pasteClipboardCards();
        return;
      }

      if (key === "x" && !event.shiftKey && selectedCardsAvailable) {
        event.preventDefault();
        void cutSelectedCards();
        return;
      }

      const isRedo =
        (key === "z" && event.shiftKey) ||
        (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey);
      if (isRedo && redoStackRef.current.length > 0) {
        event.preventDefault();
        void redoLastCommand();
        return;
      }

      if (key === "z" && !event.shiftKey && undoStackRef.current.length > 0) {
        event.preventDefault();
        void undoLastCommand();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    copySelectedCards,
    cutSelectedCards,
    deleteSelectedCards,
    deleteSelectedConnection,
    pasteClipboardCards,
    redoLastCommand,
    selectedConnectionId,
    shortcutsBlocked,
    undoLastCommand,
  ]);

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
            onSelect: handleSelectConnection,
            onOpenEditor: handleOpenConnectionEditor,
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
      handleSelectConnection,
      handleOpenConnectionEditor,
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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onSelectionStart={() => setInspectedCardId(null)}
        onNodeClick={handleNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
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
          clearCardSelection();
          setSelectedConnectionId(null);
          setInspectedConnectionId(null);
          setVisualEditingCardId(null);
          setVisualEditingConnectionId(null);
          setConnectionCreateError(null);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          const storedViewport = readStoredBoardViewport(board.id);
          if (storedViewport) {
            void instance.setViewport(storedViewport);
          } else {
            void instance.fitView({ padding: 0.3 });
          }
        }}
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
        selectionOnDrag={!visualEditingCardId && !visualEditingConnectionId}
        selectionMode={SelectionMode.Full}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        panOnDrag={visualEditingCardId || visualEditingConnectionId ? true : [1, 2]}
        zoomOnScroll={true}
      >
        <svg className="v2ConnectorMarkerDefs" aria-hidden="true" focusable="false">
          <defs>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.arrow}
              viewBox="0 0 14 14"
              refX="3"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 14 7 L 0 14 z" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.reverseArrow}
              viewBox="0 0 14 14"
              refX="3"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 14 0 L 0 7 L 14 14 z" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.triangle}
              viewBox="0 0 14 14"
              refX="3"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 14 7 L 0 14 z" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.circle}
              viewBox="0 0 14 14"
              refX="3"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <circle cx="7" cy="7" r="7" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.square}
              viewBox="0 0 14 14"
              refX="3"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <rect x="0" y="0" width="14" height="14" rx="1" fill="context-stroke" />
            </marker>
            <marker
              id={V2_CONNECTOR_MARKER_IDS.ring}
              viewBox="0 0 14 14"
              refX="3"
              refY="7"
              markerWidth="14"
              markerHeight="14"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <circle
                cx="7"
                cy="7"
                r="5.5"
                fill="var(--yd-surface-app, #f7f9fc)"
                stroke="context-stroke"
                strokeWidth="3"
              />
            </marker>
          </defs>
        </svg>
        <V2CardCreateToolbar
          cardTypes={cardTypes}
          onCreateCard={handleCreateCard}
          onManageCardTypes={handleOpenCardTypeManager}
          connectorControl={
            <V2ConnectionTypeToolbar
              connectionTypes={connectionTypes}
              activeConnectionType={activeConnectionType}
              onSelect={handleSelectConnectionType}
              onManage={() => handleOpenConnectionTypeManager(activeConnectionType?.id)}
            />
          }
        />
        {SHOW_EXPERIMENTAL_RUN_AI ? (
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
        ) : null}
        {SHOW_EXPERIMENTAL_RUN_AI && isAssistantOpen ? (
          <V2AiAssistantPanel
            context={assistantContext}
            onClose={() => setIsAssistantOpen(false)}
          />
        ) : null}
        {SHOW_EXPERIMENTAL_RUN_AI && dryRunResult ? (
          <V2RunDryRunPanel
            result={dryRunResult}
            onClose={() => setDryRunResult(null)}
          />
        ) : null}
        <Background color="var(--yd-border-subtle)" gap={24} size={1} />
        <Controls
          className="v2BoardControls"
          position="bottom-left"
          showInteractive={false}
        />
        <MiniMap
          className="v2BoardMiniMap"
          position="bottom-left"
          nodeColor={(node) => getMiniMapNodeColor(node as V2CardNode)}
          maskColor="rgba(0,0,0,0.08)"
        />
        {(editorCommandError ?? movementSaveError ?? connectionCreateError) ? (
          <div className="v2CanvasConnectionError" role="status">
            {editorCommandError ?? movementSaveError ?? connectionCreateError}
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
          />
        ) : null}
      </ReactFlow>
      {inspectedCard ? (
        <V2CardInspector
          card={inspectedCard}
          cardType={inspectedCardType}
          cardTypes={cardTypes}
          incomingConnections={incomingConnections}
          outgoingConnections={outgoingConnections}
          cardById={cardById}
          allCards={boardCards}
          allConnections={connectionRecords}
          linkedFieldBindings={linkedFieldBindings}
          linkedFieldBindingsLoading={linkedFieldBindingsLoading}
          linkedFieldBindingsError={linkedFieldBindingsError}
          calculationEvaluation={calculationEvaluation}
          calculationLoading={calculationLoading}
          calculationError={calculationError}
          saveStatus={saveStatus}
          pendingAction={pendingCardAction?.cardId === inspectedCard.id ? pendingCardAction.action : null}
          actionError={cardActionError?.cardId === inspectedCard.id ? cardActionError.message : null}
          onUpdateCardBasics={handleUpdateCardBasics}
          onUpdateCardData={handleUpdateCardData}
          onCreateLinkedFieldBinding={handleCreateLinkedFieldBinding}
          onUpdateLinkedFieldBinding={handleUpdateLinkedFieldBinding}
          onDeleteLinkedFieldBinding={handleDeleteLinkedFieldBinding}
          onManageCardType={handleOpenCardTypeManager}
          onDuplicateCard={handleDuplicateCard}
          onDeleteCard={handleDeleteCard}
          attachments={inspectedCardAttachments}
          attachmentsLoading={attachmentLoadingCardIds.has(inspectedCard.id)}
          onLoadAttachments={loadCardAttachments}
          onAttachmentsChange={handleAttachmentsChange}
          onOpenAttachment={handleOpenAttachment}
          onClose={() => setInspectedCardId(null)}
        />
      ) : inspectedConnection ? (
        <V2ConnectorInspector
          connection={inspectedConnection}
          connectionType={inspectedConnectionType}
          connectionTypes={connectionTypes}
          sourceCard={cardById.get(inspectedConnection.sourceCardId) ?? null}
          targetCard={cardById.get(inspectedConnection.targetCardId) ?? null}
          saveStatus={saveStatus}
          onUpdateConnection={handleUpdateConnection}
          onDeleteConnection={handleDeleteConnection}
          onCreateTypeFromConnection={handleCreateTypeFromConnection}
          onManageConnectionType={handleOpenConnectionTypeManager}
          onClose={() => setInspectedConnectionId(null)}
        />
      ) : null}
      {previewedAttachment && previewAttachmentIndex >= 0 ? (
        <V2FilePreviewModal
          attachments={previewAttachments}
          index={previewAttachmentIndex}
          onIndexChange={(index) => {
            const attachment = previewAttachments[index];
            if (attachment) {
              setPreviewedAttachment({
                cardId: previewedAttachment.cardId,
                attachmentId: attachment.id,
              });
            }
          }}
          onClose={() => setPreviewedAttachment(null)}
        />
      ) : null}
      {isCardTypeManagerOpen ? (
        <V2CardTypeManager
          cardTypes={cardTypes}
          initialCardTypeId={cardTypeManagerInitialId}
          onCreateCardType={handleCreateCardType}
          onUpdateCardType={handleUpdateCardType}
          onDeleteCardType={handleDeleteCardType}
          onClose={() => setIsCardTypeManagerOpen(false)}
        />
      ) : null}
      {isConnectionTypeManagerOpen ? (
        <V2ConnectionTypeManager
          connectionTypes={connectionTypes}
          initialConnectionTypeId={connectionTypeManagerInitialId}
          initialNewTypeSeed={connectionTypeManagerNewTypeSeed}
          onCreateConnectionType={handleCreateConnectionTypeFromManager}
          onUpdateConnectionType={handleUpdateConnectionType}
          onClose={() => {
            setIsConnectionTypeManagerOpen(false);
            setConnectionTypeManagerNewTypeSeed(null);
            setConnectionTypeManagerSourceConnectionId(null);
          }}
        />
      ) : null}
    </>
  );
}

function isFiniteCanvasPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
  );
}

function translateInternalManualRoute(
  connection: V2Connection,
  movedCardIds: Set<string>,
  delta: { x: number; y: number }
): V2ConnectionVisualStyle | null {
  if (
    connection.visualStyle.routeMode !== "manual" ||
    !movedCardIds.has(connection.sourceCardId) ||
    !movedCardIds.has(connection.targetCardId)
  ) {
    return null;
  }

  const hasWaypoints = Array.isArray(connection.visualStyle.waypoints);
  const hasLabelPosition = isFiniteCanvasPoint(connection.visualStyle.labelPosition);
  if (!hasWaypoints && !hasLabelPosition) return null;

  return {
    ...connection.visualStyle,
    ...(hasWaypoints
      ? {
          waypoints: connection.visualStyle.waypoints!.map((point) => ({
            x: point.x + delta.x,
            y: point.y + delta.y,
          })),
        }
      : {}),
    ...(hasLabelPosition
      ? {
          labelPosition: {
            x: connection.visualStyle.labelPosition!.x + delta.x,
            y: connection.visualStyle.labelPosition!.y + delta.y,
          },
        }
      : {}),
  };
}
