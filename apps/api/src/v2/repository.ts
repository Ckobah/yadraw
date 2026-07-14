import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import {
  v2BoardDetailSchema,
  v2CardAttachmentSchema,
  v2CardLibraryEntrySchema,
  v2CardSchema,
  v2CardTypePortSchema,
  v2CardTypeSchema,
  v2ConnectionAttachmentSchema,
  v2ConnectionTypeSchema,
  v2ConnectionSchema,
  v2LinkedFieldBindingSchema,
  type V2Board,
  type V2BoardSummary,
  type V2DuplicateBoardRequest,
  type V2BootstrapSessionResponse,
  type V2BoardDetail,
  type V2CardAttachment,
  type V2Card,
  type V2CardLibraryEntry,
  type V2CardLibraryEntryListResponse,
  type V2CardStatus,
  type V2CardType,
  type V2CardTypePortInput,
  type V2CardTypePort,
  type V2CardTypeSchema,
  type V2CardVisualStyle,
  type V2Connection,
  type V2ConnectionAttachment,
  type V2ConnectionStatus,
  type V2ConnectionType,
  type V2CreateConnectionInput,
  type V2CreateCardLibraryEntryInput,
  type V2CreateLinkedFieldBindingInput,
  type V2JsonObject,
  type V2LinkedFieldBinding,
  type V2ListCardLibraryEntriesQuery,
  type V2Project,
  type V2Size,
  type V2UpdateCardTypeInput,
  type V2UpdateBoardLayoutInput,
  type V2UpdateBoardLayoutResponse,
  type V2UpdateCardInput,
  type V2UpdateCardLibraryEntryInput,
  type V2UpdateConnectionInput,
  type V2UpdateLinkedFieldBindingInput,
  type V2Viewport,
  type V2Workspace,
  type V2WorkspaceSummary,
  type V2WorkspaceRole
} from "@yadraw/shared";

export type V2CreateCardRecordInput = {
  workspaceId: string;
  boardId: string;
  cardTypeId: string;
  libraryEntryId?: string | null;
  title: string;
  description: string;
  data: V2JsonObject;
  position: { x: number; y: number };
  size: V2Size;
  status: V2CardStatus;
  visualStyle?: Record<string, unknown>;
};

export type V2CreateCardTypeRecordInput = {
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  schema: V2CardTypeSchema;
  defaultSize: V2Size;
  defaultVisualStyle: V2CardVisualStyle;
  ports: V2CardTypePortInput[];
};

export type V2CreateConnectionTypeRecordInput = {
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  schema: V2ConnectionType["schema"];
  defaultVisualStyle: V2ConnectionType["defaultVisualStyle"];
};

export type V2DeleteCardTypeResult =
  | { status: "deleted"; cardCount: 0; libraryEntryCount: 0 }
  | { status: "in_use"; cardCount: number; libraryEntryCount: number }
  | { status: "not_found"; cardCount: 0; libraryEntryCount: 0 };

export type V2CreateCardLibraryEntryRecordInput = V2CreateCardLibraryEntryInput & {
  workspaceId: string;
  cardTypeId: string;
};

export type V2UpdateCardLibraryEntryResult =
  | { status: "updated"; entry: V2CardLibraryEntry }
  | { status: "version_conflict"; entry: V2CardLibraryEntry }
  | { status: "not_found" };

export type V2DeleteCardLibraryEntryResult =
  | { status: "deleted" }
  | { status: "in_use"; usageCount: number }
  | { status: "version_conflict"; entry: V2CardLibraryEntry }
  | { status: "not_found" };

export type V2SetCardLibraryEntryResult =
  | { status: "updated"; card: V2Card }
  | { status: "conflict"; card: V2Card }
  | { status: "entry_not_found" }
  | { status: "card_not_found" };

export type V2UpdateConnectionTypeInput = {
  key?: string;
  name?: string;
  description?: string | null;
  schema?: V2ConnectionType["schema"];
  defaultVisualStyle?: V2ConnectionType["defaultVisualStyle"];
};

export type V2CreateConnectionRecordInput = V2CreateConnectionInput & {
  workspaceId: string;
  boardId: string;
  status: V2ConnectionStatus;
};

export type V2UpdateConnectionRecordInput = V2UpdateConnectionInput & {
  status?: V2ConnectionStatus;
};

export type V2CreateLinkedFieldBindingRecordInput = V2CreateLinkedFieldBindingInput & {
  workspaceId: string;
  boardId: string;
  status: "active";
};

export type V2CreateCardAttachmentRecordInput = {
  fileId: string;
  cardId: string;
  workspaceId: string;
  storageBucket: string;
  storagePath: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  role?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type V2CreateConnectionAttachmentRecordInput = {
  fileId: string;
  connectionId: string;
  workspaceId: string;
  storageBucket: string;
  storagePath: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  role?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type V2FileDownloadRecord = {
  fileId: string;
  workspaceId: string;
  storageBucket: string;
  storagePath: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type V2BootstrapUserInput = {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  authProvider: "supabase";
  demoBoardId: string;
};

export type V2Repository = {
  close?(): Promise<void>;
  healthCheck?(): Promise<void>;
  getWorkspaceRole(userId: string, workspaceId: string): Promise<V2WorkspaceRole | null>;
  getBoardRole(userId: string, boardId: string): Promise<V2WorkspaceRole | null>;
  getCardRole(userId: string, cardId: string): Promise<V2WorkspaceRole | null>;
  getConnectionRole(userId: string, connectionId: string): Promise<V2WorkspaceRole | null>;
  getBoardDetail(boardId: string): Promise<V2BoardDetail | null>;
  getBoard(boardId: string): Promise<V2Board | null>;
  updateBoardLayout?(
    boardId: string,
    input: V2UpdateBoardLayoutInput
  ): Promise<V2UpdateBoardLayoutResponse | null>;
  bootstrapPersonalWorkspace?(input: V2BootstrapUserInput): Promise<V2BootstrapSessionResponse>;
  listUserWorkspaces?(userId: string): Promise<V2WorkspaceSummary[]>;
  listWorkspaceBoards?(workspaceId: string): Promise<V2BoardSummary[]>;
  createBoard?(workspaceId: string, name: string): Promise<V2BoardSummary>;
  updateBoard?(boardId: string, input: { name?: string; archived?: boolean }): Promise<V2BoardSummary | null>;
  duplicateBoard?(boardId: string, input: V2DuplicateBoardRequest): Promise<V2BoardSummary | null>;
  deleteBoard?(boardId: string): Promise<boolean>;
  deleteUserData?(userId: string): Promise<boolean>;
  listCardTypes(workspaceId: string): Promise<V2CardType[]>;
  listConnectionTypes?(workspaceId: string): Promise<V2ConnectionType[]>;
  getCardType(cardTypeId: string): Promise<V2CardType | null>;
  getConnectionType?(connectionTypeId: string): Promise<V2ConnectionType | null>;
  createConnectionType?(input: V2CreateConnectionTypeRecordInput): Promise<V2ConnectionType>;
  updateConnectionType?(connectionTypeId: string, input: V2UpdateConnectionTypeInput): Promise<V2ConnectionType | null>;
  createCardType?(input: V2CreateCardTypeRecordInput): Promise<V2CardType>;
  updateCardType?(cardTypeId: string, input: V2UpdateCardTypeInput): Promise<V2CardType | null>;
  updateCardTypeSchema?(cardTypeId: string, schema: V2CardTypeSchema): Promise<V2CardType | null>;
  deleteCardType?(cardTypeId: string): Promise<V2DeleteCardTypeResult>;
  listCardLibraryEntries?(
    workspaceId: string,
    cardTypeId: string,
    query: V2ListCardLibraryEntriesQuery
  ): Promise<V2CardLibraryEntryListResponse | null>;
  getCardLibraryEntry?(libraryEntryId: string): Promise<V2CardLibraryEntry | null>;
  createCardLibraryEntry?(
    input: V2CreateCardLibraryEntryRecordInput
  ): Promise<V2CardLibraryEntry>;
  updateCardLibraryEntry?(
    libraryEntryId: string,
    input: V2UpdateCardLibraryEntryInput
  ): Promise<V2UpdateCardLibraryEntryResult>;
  deleteCardLibraryEntry?(
    libraryEntryId: string,
    expectedVersion: number
  ): Promise<V2DeleteCardLibraryEntryResult>;
  getCard(cardId: string): Promise<V2Card | null>;
  createCard(input: V2CreateCardRecordInput): Promise<V2Card>;
  duplicateCard?(cardId: string): Promise<V2Card | null>;
  updateCard(cardId: string, input: V2UpdateCardInput): Promise<V2Card | null>;
  setCardLibraryEntry?(
    cardId: string,
    libraryEntryId: string | null,
    expectedLibraryEntryId: string | null
  ): Promise<V2SetCardLibraryEntryResult>;
  deleteCard(cardId: string): Promise<boolean>;
  getConnection(connectionId: string): Promise<V2Connection | null>;
  createConnection(input: V2CreateConnectionRecordInput): Promise<V2Connection>;
  updateConnection?(connectionId: string, input: V2UpdateConnectionRecordInput): Promise<V2Connection | null>;
  deleteConnection(connectionId: string): Promise<boolean>;
  listLinkedFieldBindings?(boardId: string): Promise<V2LinkedFieldBinding[]>;
  getLinkedFieldBinding?(bindingId: string): Promise<V2LinkedFieldBinding | null>;
  createLinkedFieldBinding?(input: V2CreateLinkedFieldBindingRecordInput): Promise<V2LinkedFieldBinding>;
  updateLinkedFieldBinding?(bindingId: string, input: V2UpdateLinkedFieldBindingInput): Promise<V2LinkedFieldBinding | null>;
  deleteLinkedFieldBinding?(bindingId: string): Promise<boolean>;
  listCardAttachments?(cardId: string): Promise<V2CardAttachment[]>;
  createCardAttachment?(input: V2CreateCardAttachmentRecordInput): Promise<V2CardAttachment>;
  listConnectionAttachments?(connectionId: string): Promise<V2ConnectionAttachment[]>;
  createConnectionAttachment?(input: V2CreateConnectionAttachmentRecordInput): Promise<V2ConnectionAttachment>;
  getFileForDownload?(fileId: string): Promise<V2FileDownloadRecord | null>;
  detachCardAttachment?(cardId: string, attachmentId: string): Promise<boolean>;
  detachConnectionAttachment?(connectionId: string, attachmentId: string): Promise<boolean>;
};

type V2MemorySeed = {
  workspace: V2Workspace;
  project: V2Project;
  board: V2Board;
  workspaceMembers: Array<{
    workspaceId: string;
    userId: string;
    role: V2WorkspaceRole;
  }>;
  cardTypes: V2CardType[];
  deletedCardTypeIds?: string[];
  libraryEntries?: V2CardLibraryEntry[];
  deletedLibraryEntryIds?: string[];
  connectionTypes?: V2ConnectionType[];
  deletedConnectionTypeIds?: string[];
  cards: V2Card[];
  connections: V2Connection[];
  fieldBindings?: V2MemoryLinkedFieldBinding[];
  files?: Array<{
    id: string;
    workspaceId: string;
    storageBucket: string;
    storagePath: string;
    filename: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    sha256?: string | null;
    metadata: Record<string, unknown>;
    processingStatus: "pending" | "processing" | "processed" | "failed";
    createdBy?: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
  }>;
  cardFiles?: Array<{
    id: string;
    workspaceId: string;
    cardId: string;
    fileId: string;
    role: string;
    metadata: Record<string, unknown>;
    createdBy?: string | null;
    createdAt: string;
    deletedAt?: string | null;
  }>;
  connectionFiles?: Array<{
    id: string;
    workspaceId: string;
    connectionId: string;
    fileId: string;
    role: string;
    metadata: Record<string, unknown>;
    createdBy?: string | null;
    createdAt: string;
    deletedAt?: string | null;
  }>;
};

type V2MemoryLinkedFieldBinding = Omit<V2LinkedFieldBinding, "status"> & {
  status: "active" | "deleted";
  deletedAt?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function workspaceFromRow(row: QueryResultRow): V2Workspace {
  return {
    id: String(row.workspace_id ?? row.id),
    name: String(row.workspace_name ?? row.name),
    slug: String(row.workspace_slug ?? row.slug),
    createdAt: toIso(row.workspace_created_at ?? row.created_at),
    updatedAt: toIso(row.workspace_updated_at ?? row.updated_at)
  };
}

function projectFromRow(row: QueryResultRow): V2Project {
  return {
    id: String(row.project_id ?? row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.project_name ?? row.name),
    createdAt: toIso(row.project_created_at ?? row.created_at),
    updatedAt: toIso(row.project_updated_at ?? row.updated_at)
  };
}

function boardFromRow(row: QueryResultRow): V2Board {
  const viewport: V2Viewport = {
    x: Number(row.viewport_x),
    y: Number(row.viewport_y),
    zoom: Number(row.viewport_zoom)
  };

  return {
    id: String(row.board_id ?? row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    name: String(row.board_name ?? row.name),
    viewport,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    createdAt: toIso(row.board_created_at ?? row.created_at),
    updatedAt: toIso(row.board_updated_at ?? row.updated_at)
  };
}

function workspaceSummaryFromRow(row: QueryResultRow): V2WorkspaceSummary {
  return {
    id: String(row.workspace_id ?? row.id),
    name: String(row.workspace_name ?? row.name),
    slug: String(row.workspace_slug ?? row.slug),
    role: row.role as V2WorkspaceRole,
    updatedAt: toIso(row.workspace_updated_at ?? row.updated_at)
  };
}

function boardSummaryFromRow(row: QueryResultRow): V2BoardSummary {
  return {
    id: String(row.board_id ?? row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.board_name ?? row.name),
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    updatedAt: toIso(row.board_updated_at ?? row.updated_at)
  };
}

function personalWorkspaceName(name: string, email: string): string {
  const displayName = name.trim() || email.split("@")[0] || "Personal";
  return `${displayName}'s workspace`;
}

function personalWorkspaceSlug(userId: string): string {
  return `personal-${userId.replace(/-/g, "").slice(0, 20)}`;
}

function cardTypePortFromRow(row: QueryResultRow): V2CardTypePort {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    cardTypeId: String(row.card_type_id),
    key: String(row.key),
    label: String(row.label),
    direction: row.direction,
    dataType: String(row.data_type),
    required: Boolean(row.required),
    sortOrder: Number(row.sort_order),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function cardTypeFromRow(row: QueryResultRow, ports: V2CardTypePort[] = []): V2CardType {
  return v2CardTypeSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description ?? ""),
    defaultData: asObject(row.default_data),
    schema: asObject(row.schema ?? { fields: [] }),
    defaultVisualStyle: asObject(row.default_visual_style ?? {}),
    defaultSize: {
      width: Number(row.default_width),
      height: Number(row.default_height)
    },
    ports,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  });
}

function cardLibraryEntryFromRow(row: QueryResultRow): V2CardLibraryEntry {
  return v2CardLibraryEntrySchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    cardTypeId: String(row.card_type_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    data: asObject(row.data),
    version: Number(row.version),
    archivedAt: row.archived_at ? toIso(row.archived_at) : null,
    usageCount: Number(row.usage_count ?? 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  });
}

function connectionTypeFromRow(row: QueryResultRow): V2ConnectionType {
  return v2ConnectionTypeSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    key: String(row.key),
    name: String(row.name),
    description: row.description === null || row.description === undefined ? null : String(row.description),
    schema: asObject(row.schema ?? { fields: [] }),
    defaultVisualStyle: asObject(row.default_visual_style ?? {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  });
}

function cardFromRow(row: QueryResultRow): V2Card {
  return v2CardSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    boardId: String(row.board_id),
    cardTypeId: String(row.card_type_id),
    libraryEntryId:
      row.library_entry_id === null || row.library_entry_id === undefined
        ? null
        : String(row.library_entry_id),
    title: String(row.resolved_title ?? row.title),
    description: String(row.resolved_description ?? row.description ?? ""),
    data: asObject(row.resolved_data ?? row.data),
    position: {
      x: Number(row.position_x),
      y: Number(row.position_y)
    },
    size: {
      width: Number(row.width),
      height: Number(row.height)
    },
    visualStyle: asObject(row.visual_style),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.resolved_updated_at ?? row.updated_at)
  });
}

const resolvedCardColumns = `
  c.*,
  coalesce(library_entry.title, c.title) as resolved_title,
  coalesce(library_entry.description, c.description) as resolved_description,
  coalesce(library_entry.data, c.data) as resolved_data,
  greatest(c.updated_at, coalesce(library_entry.updated_at, c.updated_at)) as resolved_updated_at
`;

const resolvedCardJoin = `
  left join card_library_entries library_entry
    on library_entry.id = c.library_entry_id
   and library_entry.workspace_id = c.workspace_id
   and library_entry.card_type_id = c.card_type_id
   and library_entry.deleted_at is null
`;

function connectionFromRow(row: QueryResultRow): V2Connection {
  return v2ConnectionSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    boardId: String(row.board_id),
    connectionTypeId:
      row.connection_type_id === null || row.connection_type_id === undefined
        ? null
        : String(row.connection_type_id),
    sourceCardId: String(row.source_card_id),
    targetCardId: String(row.target_card_id),
    sourcePortKey: String(row.source_port_key),
    targetPortKey: String(row.target_port_key),
    title: row.title === null || row.title === undefined ? null : String(row.title),
    description: row.description === null || row.description === undefined ? null : String(row.description),
    data: asObject(row.data),
    visualStyle: asObject(row.visual_style),
    type: String(row.type),
    label: String(row.label ?? ""),
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  });
}

function linkedFieldBindingFromRow(row: QueryResultRow): V2LinkedFieldBinding {
  return v2LinkedFieldBindingSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    boardId: String(row.board_id),
    targetCardId: String(row.target_card_id),
    targetField: String(row.target_field),
    sourceMode: String(row.source_mode),
    direction: String(row.connection_direction),
    sourceCardId: row.source_card_id === null || row.source_card_id === undefined ? null : String(row.source_card_id),
    sourceCardTypeId:
      row.source_card_type_id === null || row.source_card_type_id === undefined
        ? null
        : String(row.source_card_type_id),
    sourceCardTypeKey:
      row.source_card_type_key === null || row.source_card_type_key === undefined
        ? null
        : String(row.source_card_type_key),
    sourceFieldPath: String(row.source_field_path),
    onMissing: String(row.on_missing),
    onMultiple: String(row.on_multiple),
    status: String(row.status),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  });
}

function portsByCardType(ports: V2CardTypePort[]): Map<string, V2CardTypePort[]> {
  const grouped = new Map<string, V2CardTypePort[]>();

  for (const port of ports) {
    grouped.set(port.cardTypeId, [...(grouped.get(port.cardTypeId) ?? []), port]);
  }

  return grouped;
}

export function createDefaultV2MemorySeed(): V2MemorySeed {
  const timestamp = "2026-01-01T00:00:00.000Z";
  const workspace: V2Workspace = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Local Workspace",
    slug: "local-workspace",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const project: V2Project = {
    id: "22222222-2222-4222-8222-222222222222",
    workspaceId: workspace.id,
    name: "Core Project",
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const board: V2Board = {
    id: "33333333-3333-4333-8333-333333333333",
    workspaceId: workspace.id,
    projectId: project.id,
    name: "Main Board",
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const sourceTypeId = "44444444-4444-4444-8444-444444444444";
  const taskTypeId = "55555555-5555-4555-8555-555555555555";
  const genericConnectionTypeId = "99999999-9999-4999-8999-999999999991";
  const cardTypes: V2CardType[] = [
    {
      id: sourceTypeId,
      workspaceId: workspace.id,
      key: "source",
      name: "Source",
      description: "Provides input data.",
      defaultData: { kind: "source" },
      schema: { fields: [] },
      defaultVisualStyle: {},
      defaultSize: { width: 196, height: 122 },
      ports: [
        {
          id: "66666666-6666-4666-8666-666666666661",
          workspaceId: workspace.id,
          cardTypeId: sourceTypeId,
          key: "payload",
          label: "Payload",
          direction: "output",
          dataType: "json",
          required: true,
          sortOrder: 0,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: taskTypeId,
      workspaceId: workspace.id,
      key: "task",
      name: "Task",
      description: "Transforms input data.",
      defaultData: { kind: "task" },
      schema: { fields: [] },
      defaultVisualStyle: {},
      defaultSize: { width: 196, height: 122 },
      ports: [
        {
          id: "66666666-6666-4666-8666-666666666662",
          workspaceId: workspace.id,
          cardTypeId: taskTypeId,
          key: "input",
          label: "Input",
          direction: "input",
          dataType: "json",
          required: true,
          sortOrder: 0,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        {
          id: "66666666-6666-4666-8666-666666666663",
          workspaceId: workspace.id,
          cardTypeId: taskTypeId,
          key: "result",
          label: "Result",
          direction: "output",
          dataType: "json",
          required: false,
          sortOrder: 1,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
  const connectionTypes: V2ConnectionType[] = [
    {
      id: genericConnectionTypeId,
      workspaceId: workspace.id,
      key: "generic",
      name: "Generic",
      description: "Default relationship type.",
      schema: { fields: [] },
      defaultVisualStyle: {},
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "99999999-9999-4999-8999-999999999992",
      workspaceId: workspace.id,
      key: "contains",
      name: "Contains",
      description: "One card contains another.",
      schema: {
        fields: [
          {
            key: "quantity",
            label: "Quantity per assembly",
            type: "number",
            required: true,
            defaultValue: 1,
            numberConstraints: { min: 0, integer: true }
          },
          {
            key: "unit",
            label: "Unit",
            type: "select",
            required: true,
            defaultValue: "piece",
            options: [
              { value: "piece", label: "pcs" },
              { value: "pcs", label: "pcs (legacy)" }
            ]
          },
          { key: "note", label: "Note", type: "text" }
        ],
        semantics: {
          version: 1,
          sourceRole: "component",
          targetRole: "assembly",
          quantity: {
            valueField: "quantity",
            unitField: "unit",
            basis: "per_target",
            targetMultiplierField: "plannedQuantity",
            aggregation: "sum"
          }
        }
      },
      defaultVisualStyle: {},
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "99999999-9999-4999-8999-999999999993",
      workspaceId: workspace.id,
      key: "supplies",
      name: "Supplies",
      description: "A supplier relationship.",
      schema: {
        fields: [
          { key: "price", label: "Price", type: "number" },
          { key: "currency", label: "Currency", type: "text" },
          { key: "leadTimeDays", label: "Lead time days", type: "number" },
          { key: "minOrderQty", label: "Minimum order quantity", type: "number" },
          { key: "note", label: "Note", type: "text" }
        ]
      },
      defaultVisualStyle: {},
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "99999999-9999-4999-8999-999999999994",
      workspaceId: workspace.id,
      key: "uses",
      name: "Uses",
      description: "One card uses another.",
      schema: {
        fields: [
          { key: "quantity", label: "Quantity", type: "number" },
          { key: "unit", label: "Unit", type: "text" },
          { key: "note", label: "Note", type: "text" }
        ]
      },
      defaultVisualStyle: {},
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "99999999-9999-4999-8999-999999999995",
      workspaceId: workspace.id,
      key: "depends_on",
      name: "Depends on",
      description: "A dependency relationship.",
      schema: {
        fields: [
          { key: "dependencyType", label: "Dependency type", type: "text" },
          { key: "lagDays", label: "Lag days", type: "number" },
          { key: "note", label: "Note", type: "text" }
        ]
      },
      defaultVisualStyle: {},
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
  const cards: V2Card[] = [
    {
      id: "77777777-7777-4777-8777-777777777771",
      workspaceId: workspace.id,
      boardId: board.id,
      cardTypeId: sourceTypeId,
      title: "Incoming data",
      description: "Source payload for the board.",
      data: { kind: "source", endpoint: "/input" },
      position: { x: 120, y: 160 },
      size: { width: 196, height: 122 },
      visualStyle: {},
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    {
      id: "77777777-7777-4777-8777-777777777772",
      workspaceId: workspace.id,
      boardId: board.id,
      cardTypeId: taskTypeId,
      title: "Normalize payload",
      description: "Transforms incoming data into a clean JSON shape.",
      data: { kind: "task", operation: "normalize" },
      position: { x: 390, y: 160 },
      size: { width: 196, height: 122 },
      visualStyle: {},
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
  const connections: V2Connection[] = [
    {
      id: "88888888-8888-4888-8888-888888888881",
      workspaceId: workspace.id,
      boardId: board.id,
      connectionTypeId: genericConnectionTypeId,
      sourceCardId: cards[0]!.id,
      targetCardId: cards[1]!.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      title: null,
      description: null,
      data: {},
      visualStyle: {},
      type: "data",
      label: "payload",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  return {
    workspace,
    project,
    board,
    workspaceMembers: [
      {
        workspaceId: workspace.id,
        userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
        role: "owner"
      },
      {
        workspaceId: workspace.id,
        userId: "bb7ef8c4-91fd-4f3a-86d2-fb760a532c45",
        role: "editor"
      },
      {
        workspaceId: workspace.id,
        userId: "9f18a762-53e5-4922-9b0b-8f168921bb0f",
        role: "viewer"
      }
    ],
    cardTypes,
    connectionTypes,
    cards,
    connections
  };
}

function attachmentFromRow(row: QueryResultRow): V2CardAttachment {
  return v2CardAttachmentSchema.parse({
    id: String(row.card_file_id ?? row.id),
    cardId: String(row.card_id),
    fileId: String(row.file_id),
    role: String(row.role),
    filename: String(row.filename),
    mimeType: row.mime_type === null || row.mime_type === undefined ? null : String(row.mime_type),
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    processingStatus: row.processing_status,
    createdAt: toIso(row.created_at)
  });
}

function connectionAttachmentFromRow(row: QueryResultRow): V2ConnectionAttachment {
  return v2ConnectionAttachmentSchema.parse({
    id: String(row.connection_file_id ?? row.id),
    connectionId: String(row.connection_id),
    fileId: String(row.file_id),
    role: String(row.role),
    metadata: asObject(row.metadata),
    filename: String(row.filename),
    mimeType: row.mime_type === null || row.mime_type === undefined ? null : String(row.mime_type),
    sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    sha256: row.sha256 === null || row.sha256 === undefined ? null : String(row.sha256),
    processingStatus: row.processing_status,
    createdAt: toIso(row.created_at)
  });
}

export function createV2MemoryRepository(seed: V2MemorySeed = createDefaultV2MemorySeed()): V2Repository {
  const state = {
    ...cloneJson(seed),
    libraryEntries: cloneJson(seed.libraryEntries ?? []),
    connectionTypes: cloneJson(seed.connectionTypes ?? []),
    fieldBindings: cloneJson((seed.fieldBindings ?? []) as V2MemoryLinkedFieldBinding[]),
    files: cloneJson(seed.files ?? []),
    cardFiles: cloneJson(seed.cardFiles ?? []),
    connectionFiles: cloneJson(seed.connectionFiles ?? [])
  };
  const deletedCardIds = new Set<string>();
  const deletedConnectionIds = new Set<string>();
  const deletedCardTypeIds = new Set<string>(state.deletedCardTypeIds ?? []);
  const deletedLibraryEntryIds = new Set<string>(state.deletedLibraryEntryIds ?? []);
  const deletedConnectionTypeIds = new Set<string>(state.deletedConnectionTypeIds ?? []);
  const deletedCardFileIds = new Set<string>(
    state.cardFiles
      .filter((cardFile) => cardFile.deletedAt)
      .map((cardFile) => cardFile.id)
  );
  const deletedConnectionFileIds = new Set<string>(
    state.connectionFiles
      .filter((connectionFile) => connectionFile.deletedAt)
      .map((connectionFile) => connectionFile.id)
  );
  const deletedFileIds = new Set<string>(
    state.files
      .filter((file) => file.deletedAt)
      .map((file) => file.id)
  );
  const deletedFieldBindingIds = new Set<string>(
    state.fieldBindings
      .filter((binding) => binding.deletedAt || binding.status === "deleted")
      .map((binding) => binding.id)
  );

  function resolveMemoryCard(card: V2Card): V2Card {
    const libraryEntry = card.libraryEntryId
      ? state.libraryEntries.find(
          (entry) =>
            entry.id === card.libraryEntryId && !deletedLibraryEntryIds.has(entry.id)
        )
      : null;
    if (!libraryEntry) return cloneJson(card);

    return v2CardSchema.parse({
      ...cloneJson(card),
      title: libraryEntry.title,
      description: libraryEntry.description,
      data: cloneJson(libraryEntry.data),
      updatedAt:
        libraryEntry.updatedAt > card.updatedAt ? libraryEntry.updatedAt : card.updatedAt
    });
  }

  function activeStoredCards(): V2Card[] {
    return state.cards.filter((card) => !deletedCardIds.has(card.id));
  }

  function activeCards(): V2Card[] {
    return activeStoredCards().map(resolveMemoryCard);
  }

  function activeConnections(): V2Connection[] {
    const cardIds = new Set(activeCards().map((card) => card.id));
    return state.connections.filter(
      (connection) =>
        !deletedConnectionIds.has(connection.id) &&
        cardIds.has(connection.sourceCardId) &&
        cardIds.has(connection.targetCardId)
    );
  }

  function buildMemoryCardTypePorts(
    workspaceId: string,
    cardTypeId: string,
    ports: V2CardTypePortInput[],
    timestamp: string
  ): V2CardTypePort[] {
    return ports.map((port, index) =>
      v2CardTypePortSchema.parse({
        id: randomUUID(),
        workspaceId,
        cardTypeId,
        key: port.key,
        label: port.label,
        direction: port.direction,
        dataType: port.dataType,
        required: port.required,
        sortOrder: port.sortOrder ?? index,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    );
  }

  function roleForWorkspace(userId: string, workspaceId: string): V2WorkspaceRole | null {
    return (
      state.workspaceMembers.find(
        (member) => member.workspaceId === workspaceId && member.userId === userId
      )?.role ?? null
    );
  }

  return {
    async close() {},
    async healthCheck() {},

    async getWorkspaceRole(userId, workspaceId) {
      return roleForWorkspace(userId, workspaceId);
    },

    async getBoardRole(userId, boardId) {
      const board = boardId === state.board.id ? state.board : null;
      return board ? roleForWorkspace(userId, board.workspaceId) : null;
    },

    async getCardRole(userId, cardId) {
      if (deletedCardIds.has(cardId)) return null;
      const card = state.cards.find((item) => item.id === cardId);
      return card ? roleForWorkspace(userId, card.workspaceId) : null;
    },

    async getConnectionRole(userId, connectionId) {
      if (deletedConnectionIds.has(connectionId)) return null;
      const connection = state.connections.find((item) => item.id === connectionId);
      return connection ? roleForWorkspace(userId, connection.workspaceId) : null;
    },

    async getBoardDetail(boardId) {
      if (boardId !== state.board.id) return null;
      return v2BoardDetailSchema.parse({
        workspace: state.workspace,
        project: state.project,
        board: state.board,
        cardTypes: state.cardTypes.filter((cardType) => !deletedCardTypeIds.has(cardType.id)),
        connectionTypes: state.connectionTypes.filter(
          (connectionType) => !deletedConnectionTypeIds.has(connectionType.id)
        ),
        cards: activeCards(),
        cardAttachmentCounts: Object.fromEntries(
          activeCards().map((card) => [
            card.id,
            state.cardFiles.filter(
              (cardFile) =>
                cardFile.cardId === card.id &&
                !deletedCardFileIds.has(cardFile.id) &&
                !deletedFileIds.has(cardFile.fileId)
            ).length
          ])
        ),
        connections: activeConnections()
      });
    },

    async getBoard(boardId) {
      return boardId === state.board.id ? cloneJson(state.board) : null;
    },

    async updateBoard(boardId, input) {
      if (boardId !== state.board.id) return null;
      if (input.name !== undefined) state.board.name = input.name;
      if (input.archived !== undefined) {
        state.board.archivedAt = input.archived ? nowIso() : null;
      }
      state.board.updatedAt = nowIso();
      return boardSummaryFromRow({
        board_id: state.board.id,
        workspace_id: state.board.workspaceId,
        board_name: state.board.name,
        archived_at: state.board.archivedAt,
        board_updated_at: state.board.updatedAt
      });
    },

    async duplicateBoard(boardId, input) {
      if (boardId !== state.board.id) return null;
      return {
        id: randomUUID(),
        workspaceId: state.board.workspaceId,
        name: input.name ?? `${state.board.name} copy`,
        archivedAt: null,
        updatedAt: nowIso()
      };
    },

    async deleteBoard(boardId) {
      return boardId === state.board.id;
    },

    async updateBoardLayout(boardId, input) {
      if (boardId !== state.board.id) return null;
      const cards = input.cards.map((update) =>
        state.cards.find(
          (card) => card.id === update.id && card.boardId === boardId && !deletedCardIds.has(card.id)
        )
      );
      const connections = input.connections.map((update) =>
        state.connections.find(
          (connection) =>
            connection.id === update.id &&
            connection.boardId === boardId &&
            !deletedConnectionIds.has(connection.id)
        )
      );
      if (cards.some((card) => !card) || connections.some((connection) => !connection)) return null;
      const timestamp = nowIso();
      input.cards.forEach((update, index) => {
        const card = cards[index]!;
        card.position = cloneJson(update.position);
        card.updatedAt = timestamp;
      });
      input.connections.forEach((update, index) => {
        const connection = connections[index]!;
        connection.visualStyle = cloneJson(update.visualStyle);
        connection.updatedAt = timestamp;
      });
      return { updatedCards: cards.length, updatedConnections: connections.length };
    },

    async listCardTypes(workspaceId) {
      if (workspaceId !== state.workspace.id) return [];
      return cloneJson(state.cardTypes.filter((cardType) => !deletedCardTypeIds.has(cardType.id)));
    },

    async getCardType(cardTypeId) {
      if (deletedCardTypeIds.has(cardTypeId)) return null;
      return cloneJson(state.cardTypes.find((cardType) => cardType.id === cardTypeId) ?? null);
    },

    async listConnectionTypes(workspaceId) {
      if (workspaceId !== state.workspace.id) return [];
      return cloneJson(
        state.connectionTypes.filter((connectionType) => !deletedConnectionTypeIds.has(connectionType.id))
      );
    },

    async getConnectionType(connectionTypeId) {
      if (deletedConnectionTypeIds.has(connectionTypeId)) return null;
      return cloneJson(state.connectionTypes.find((connectionType) => connectionType.id === connectionTypeId) ?? null);
    },

    async createConnectionType(input) {
      const timestamp = nowIso();
      const connectionType = v2ConnectionTypeSchema.parse({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        schema: cloneJson(input.schema),
        defaultVisualStyle: cloneJson(input.defaultVisualStyle),
        createdAt: timestamp,
        updatedAt: timestamp
      });
      state.connectionTypes.push(connectionType);
      return cloneJson(connectionType);
    },

    async updateConnectionType(connectionTypeId, input) {
      if (deletedConnectionTypeIds.has(connectionTypeId)) return null;
      const index = state.connectionTypes.findIndex((connectionType) => connectionType.id === connectionTypeId);
      const existing = state.connectionTypes[index];
      if (index === -1 || !existing) return null;

      const updated = v2ConnectionTypeSchema.parse({
        ...existing,
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.schema !== undefined ? { schema: cloneJson(input.schema) } : {}),
        ...(input.defaultVisualStyle !== undefined
          ? { defaultVisualStyle: cloneJson(input.defaultVisualStyle) }
          : {}),
        updatedAt: nowIso()
      });
      state.connectionTypes[index] = updated;
      return cloneJson(updated);
    },

    async createCardType(input) {
      const timestamp = nowIso();
      const cardTypeId = randomUUID();
      const cardType = v2CardTypeSchema.parse({
        id: cardTypeId,
        workspaceId: input.workspaceId,
        key: input.key,
        name: input.name,
        description: input.description,
        defaultData: {},
        schema: cloneJson(input.schema),
        defaultVisualStyle: cloneJson(input.defaultVisualStyle),
        defaultSize: cloneJson(input.defaultSize),
        ports: buildMemoryCardTypePorts(input.workspaceId, cardTypeId, input.ports, timestamp),
        createdAt: timestamp,
        updatedAt: timestamp
      });
      state.cardTypes.push(cardType);
      return cloneJson(cardType);
    },

    async updateCardType(cardTypeId, input) {
      if (deletedCardTypeIds.has(cardTypeId)) return null;
      const index = state.cardTypes.findIndex((cardType) => cardType.id === cardTypeId);
      const existing = state.cardTypes[index];
      if (index === -1 || !existing) return null;
      const timestamp = nowIso();

      const updated = v2CardTypeSchema.parse({
        ...existing,
        ...(input.key !== undefined ? { key: input.key } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.schema !== undefined ? { schema: cloneJson(input.schema) } : {}),
        ...(input.defaultSize !== undefined ? { defaultSize: cloneJson(input.defaultSize) } : {}),
        ...(input.defaultVisualStyle !== undefined
          ? { defaultVisualStyle: cloneJson(input.defaultVisualStyle) }
          : {}),
        ...(input.ports !== undefined
          ? {
              ports: buildMemoryCardTypePorts(existing.workspaceId, existing.id, input.ports, timestamp)
            }
          : {}),
        updatedAt: timestamp
      });
      state.cardTypes[index] = updated;
      return cloneJson(updated);
    },

    async updateCardTypeSchema(cardTypeId, schema) {
      if (deletedCardTypeIds.has(cardTypeId)) return null;
      const index = state.cardTypes.findIndex((cardType) => cardType.id === cardTypeId);
      const existing = state.cardTypes[index];
      if (index === -1 || !existing) return null;

      const updated = v2CardTypeSchema.parse({
        ...existing,
        schema: cloneJson(schema),
        updatedAt: nowIso()
      });
      state.cardTypes[index] = updated;
      return cloneJson(updated);
    },

    async deleteCardType(cardTypeId) {
      if (deletedCardTypeIds.has(cardTypeId)) {
        return { status: "not_found", cardCount: 0, libraryEntryCount: 0 };
      }
      const existing = state.cardTypes.find((cardType) => cardType.id === cardTypeId);
      if (!existing) return { status: "not_found", cardCount: 0, libraryEntryCount: 0 };

      const cardCount = activeCards().filter((card) => card.cardTypeId === cardTypeId).length;
      const libraryEntryCount = state.libraryEntries.filter(
        (entry) => entry.cardTypeId === cardTypeId && !deletedLibraryEntryIds.has(entry.id)
      ).length;
      if (cardCount > 0 || libraryEntryCount > 0) {
        return { status: "in_use", cardCount, libraryEntryCount };
      }

      deletedCardTypeIds.add(cardTypeId);
      return { status: "deleted", cardCount: 0, libraryEntryCount: 0 };
    },

    async listCardLibraryEntries(workspaceId, cardTypeId, query) {
      const search = query.query?.trim().toLocaleLowerCase() ?? "";
      const entries = state.libraryEntries
        .filter(
          (entry) =>
            entry.workspaceId === workspaceId &&
            entry.cardTypeId === cardTypeId &&
            !deletedLibraryEntryIds.has(entry.id) &&
            (query.status === "all" ||
              (query.status === "archived" ? entry.archivedAt !== null : entry.archivedAt === null)) &&
            (!search ||
              entry.title.toLocaleLowerCase().includes(search) ||
              entry.description.toLocaleLowerCase().includes(search) ||
              JSON.stringify(entry.data).toLocaleLowerCase().includes(search))
        )
        .map((entry) =>
          v2CardLibraryEntrySchema.parse({
            ...cloneJson(entry),
            usageCount: activeStoredCards().filter(
              (card) => card.libraryEntryId === entry.id
            ).length
          })
        )
        .sort((left, right) => {
          const leftValue = query.sort === "updatedAt" ? left.updatedAt : left.title.toLocaleLowerCase();
          const rightValue = query.sort === "updatedAt" ? right.updatedAt : right.title.toLocaleLowerCase();
          const compared = leftValue.localeCompare(rightValue) || left.id.localeCompare(right.id);
          return query.direction === "desc" ? -compared : compared;
        });

      const cursorIndex = query.cursor
        ? entries.findIndex((entry) => entry.id === query.cursor)
        : -1;
      if (query.cursor && cursorIndex === -1) return null;
      const startIndex = cursorIndex + 1;
      const page = entries.slice(startIndex, startIndex + query.limit);
      const hasMore = startIndex + page.length < entries.length;
      return {
        entries: cloneJson(page),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null
      };
    },

    async getCardLibraryEntry(libraryEntryId) {
      if (deletedLibraryEntryIds.has(libraryEntryId)) return null;
      const entry = state.libraryEntries.find((item) => item.id === libraryEntryId);
      if (!entry) return null;
      return v2CardLibraryEntrySchema.parse({
        ...cloneJson(entry),
        usageCount: activeStoredCards().filter(
          (card) => card.libraryEntryId === libraryEntryId
        ).length
      });
    },

    async createCardLibraryEntry(input) {
      const timestamp = nowIso();
      const entry = v2CardLibraryEntrySchema.parse({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        cardTypeId: input.cardTypeId,
        title: input.title,
        description: input.description,
        data: cloneJson(input.data),
        version: 1,
        archivedAt: null,
        usageCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      state.libraryEntries.push(entry);
      return cloneJson(entry);
    },

    async updateCardLibraryEntry(libraryEntryId, input) {
      if (deletedLibraryEntryIds.has(libraryEntryId)) return { status: "not_found" };
      const index = state.libraryEntries.findIndex((entry) => entry.id === libraryEntryId);
      const existing = state.libraryEntries[index];
      if (index === -1 || !existing) return { status: "not_found" };
      if (existing.version !== input.expectedVersion) {
        return {
          status: "version_conflict",
          entry: v2CardLibraryEntrySchema.parse({
            ...cloneJson(existing),
            usageCount: activeStoredCards().filter(
              (card) => card.libraryEntryId === libraryEntryId
            ).length
          })
        };
      }

      const updated = v2CardLibraryEntrySchema.parse({
        ...existing,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.data !== undefined ? { data: cloneJson(input.data) } : {}),
        ...(input.archived !== undefined
          ? { archivedAt: input.archived ? nowIso() : null }
          : {}),
        version: existing.version + 1,
        updatedAt: nowIso(),
        selectable: undefined,
        usageCount: activeStoredCards().filter(
          (card) => card.libraryEntryId === libraryEntryId
        ).length
      });
      state.libraryEntries[index] = updated;
      return { status: "updated", entry: cloneJson(updated) };
    },

    async deleteCardLibraryEntry(libraryEntryId, expectedVersion) {
      if (deletedLibraryEntryIds.has(libraryEntryId)) return { status: "not_found" };
      const entry = state.libraryEntries.find((item) => item.id === libraryEntryId);
      if (!entry) return { status: "not_found" };
      const usageCount = activeStoredCards().filter(
        (card) => card.libraryEntryId === libraryEntryId
      ).length;
      if (entry.version !== expectedVersion) {
        return {
          status: "version_conflict",
          entry: v2CardLibraryEntrySchema.parse({ ...cloneJson(entry), usageCount })
        };
      }
      if (usageCount > 0) return { status: "in_use", usageCount };
      deletedLibraryEntryIds.add(libraryEntryId);
      return { status: "deleted" };
    },

    async getCard(cardId) {
      if (deletedCardIds.has(cardId)) return null;
      const card = state.cards.find((item) => item.id === cardId);
      return card ? resolveMemoryCard(card) : null;
    },

    async createCard(input) {
      const timestamp = nowIso();
      const card = v2CardSchema.parse({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        cardTypeId: input.cardTypeId,
        libraryEntryId: input.libraryEntryId ?? null,
        title: input.title,
        description: input.description,
        data: cloneJson(input.data),
        position: input.position,
        size: input.size,
        visualStyle: cloneJson(input.visualStyle ?? {}),
        status: input.status,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      state.cards.push(card);
      return resolveMemoryCard(card);
    },

    async duplicateCard(cardId) {
      const source = state.cards.find((card) => card.id === cardId && !deletedCardIds.has(card.id));
      if (!source) return null;

      const timestamp = nowIso();
      const card = v2CardSchema.parse({
        ...source,
        id: randomUUID(),
        data: cloneJson(source.data),
        position: {
          x: source.position.x + 40,
          y: source.position.y + 40
        },
        size: cloneJson(source.size),
        visualStyle: cloneJson(source.visualStyle ?? {}),
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      });

      state.cards.push(card);
      return resolveMemoryCard(card);
    },

    async updateCard(cardId, input) {
      const index = state.cards.findIndex((card) => card.id === cardId && !deletedCardIds.has(card.id));
      const existing = state.cards[index];
      if (index === -1 || !existing) return null;

      const updated = v2CardSchema.parse({
        ...existing,
        ...input,
        updatedAt: nowIso()
      });
      state.cards[index] = updated;
      return resolveMemoryCard(updated);
    },

    async setCardLibraryEntry(cardId, libraryEntryId, expectedLibraryEntryId) {
      const index = state.cards.findIndex(
        (card) => card.id === cardId && !deletedCardIds.has(card.id)
      );
      const existing = state.cards[index];
      if (index === -1 || !existing) return { status: "card_not_found" };
      if ((existing.libraryEntryId ?? null) !== expectedLibraryEntryId) {
        return { status: "conflict", card: resolveMemoryCard(existing) };
      }

      if (libraryEntryId !== null) {
        const entry = state.libraryEntries.find(
          (item) => item.id === libraryEntryId && !deletedLibraryEntryIds.has(item.id)
        );
        if (
          !entry ||
          entry.workspaceId !== existing.workspaceId ||
          entry.cardTypeId !== existing.cardTypeId ||
          entry.archivedAt !== null
        ) {
          return { status: "entry_not_found" };
        }
      }

      const resolved = resolveMemoryCard(existing);
      const updated = v2CardSchema.parse({
        ...existing,
        ...(libraryEntryId === null && existing.libraryEntryId
          ? {
              title: resolved.title,
              description: resolved.description,
              data: cloneJson(resolved.data)
            }
          : {}),
        libraryEntryId,
        updatedAt: nowIso()
      });
      state.cards[index] = updated;
      return { status: "updated", card: resolveMemoryCard(updated) };
    },

    async deleteCard(cardId) {
      const exists = state.cards.some((card) => card.id === cardId && !deletedCardIds.has(card.id));
      if (!exists) return false;

      deletedCardIds.add(cardId);
      for (const connection of state.connections) {
        if (connection.sourceCardId === cardId || connection.targetCardId === cardId) {
          deletedConnectionIds.add(connection.id);
        }
      }
      return true;
    },

    async getConnection(connectionId) {
      if (deletedConnectionIds.has(connectionId)) return null;
      return cloneJson(state.connections.find((connection) => connection.id === connectionId) ?? null);
    },

    async createConnection(input) {
      const timestamp = nowIso();
      const connection = v2ConnectionSchema.parse({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        connectionTypeId: input.connectionTypeId ?? null,
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        sourcePortKey: input.sourcePortKey,
        targetPortKey: input.targetPortKey,
        type: input.type,
        label: input.label,
        title: input.title ?? null,
        description: null,
        data: cloneJson(input.data ?? {}),
        visualStyle: input.visualStyle ?? {},
        status: input.status,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      state.connections.push(connection);
      return cloneJson(connection);
    },

    async updateConnection(connectionId, input) {
      const index = state.connections.findIndex(
        (connection) => connection.id === connectionId && !deletedConnectionIds.has(connection.id)
      );
      const existing = state.connections[index];
      if (index === -1 || !existing) return null;

      const updated = v2ConnectionSchema.parse({
        ...existing,
        ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.connectionTypeId !== undefined ? { connectionTypeId: input.connectionTypeId } : {}),
        ...(input.sourceCardId !== undefined ? { sourceCardId: input.sourceCardId } : {}),
        ...(input.targetCardId !== undefined ? { targetCardId: input.targetCardId } : {}),
        ...(input.sourcePortKey !== undefined ? { sourcePortKey: input.sourcePortKey } : {}),
        ...(input.targetPortKey !== undefined ? { targetPortKey: input.targetPortKey } : {}),
        ...(input.data !== undefined ? { data: cloneJson(input.data) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.visualStyle !== undefined
          ? { visualStyle: { ...existing.visualStyle, ...cloneJson(input.visualStyle) } }
          : {}),
        updatedAt: nowIso()
      });
      state.connections[index] = updated;
      return cloneJson(updated);
    },

    async deleteConnection(connectionId) {
      const exists = state.connections.some(
        (connection) => connection.id === connectionId && !deletedConnectionIds.has(connection.id)
      );
      if (!exists) return false;

      deletedConnectionIds.add(connectionId);
      return true;
    },

    async listLinkedFieldBindings(boardId) {
      return cloneJson(
        state.fieldBindings.filter(
          (binding) =>
            binding.boardId === boardId &&
            binding.status === "active" &&
            !deletedFieldBindingIds.has(binding.id)
        )
      ).map((binding) => v2LinkedFieldBindingSchema.parse(binding));
    },

    async getLinkedFieldBinding(bindingId) {
      const binding = state.fieldBindings.find(
        (item) => item.id === bindingId && item.status === "active" && !deletedFieldBindingIds.has(item.id)
      );
      return binding ? v2LinkedFieldBindingSchema.parse(cloneJson(binding)) : null;
    },

    async createLinkedFieldBinding(input) {
      const timestamp = nowIso();
      const binding = v2LinkedFieldBindingSchema.parse({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        targetCardId: input.targetCardId,
        targetField: input.targetField,
        sourceMode: input.sourceMode,
        direction: input.direction,
        sourceCardId: input.sourceCardId ?? null,
        sourceCardTypeId: input.sourceCardTypeId ?? null,
        sourceCardTypeKey: input.sourceCardTypeKey ?? null,
        sourceFieldPath: input.sourceFieldPath,
        onMissing: input.onMissing,
        onMultiple: input.onMultiple,
        status: input.status,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      state.fieldBindings.push(binding);
      return cloneJson(binding);
    },

    async updateLinkedFieldBinding(bindingId, input) {
      const index = state.fieldBindings.findIndex(
        (binding) => binding.id === bindingId && binding.status === "active" && !deletedFieldBindingIds.has(binding.id)
      );
      const existing = state.fieldBindings[index];
      if (index === -1 || !existing) return null;

      const updated = v2LinkedFieldBindingSchema.parse({
        ...existing,
        ...input,
        sourceCardId: input.sourceCardId !== undefined ? input.sourceCardId : existing.sourceCardId ?? null,
        sourceCardTypeId:
          input.sourceCardTypeId !== undefined ? input.sourceCardTypeId : existing.sourceCardTypeId ?? null,
        sourceCardTypeKey:
          input.sourceCardTypeKey !== undefined ? input.sourceCardTypeKey : existing.sourceCardTypeKey ?? null,
        updatedAt: nowIso()
      });
      state.fieldBindings[index] = updated;
      return cloneJson(updated);
    },

    async deleteLinkedFieldBinding(bindingId) {
      const binding = state.fieldBindings.find(
        (item) => item.id === bindingId && item.status === "active" && !deletedFieldBindingIds.has(item.id)
      );
      if (!binding) return false;

      binding.status = "deleted";
      binding.deletedAt = nowIso();
      binding.updatedAt = binding.deletedAt;
      deletedFieldBindingIds.add(binding.id);
      return true;
    },

    async listCardAttachments(cardId) {
      if (deletedCardIds.has(cardId)) return [];
      const card = state.cards.find((item) => item.id === cardId);
      if (!card) return [];

      return state.cardFiles
        .filter((cardFile) => cardFile.cardId === cardId && !deletedCardFileIds.has(cardFile.id))
        .map((cardFile) => {
          const file = state.files.find(
            (item) => item.id === cardFile.fileId && !deletedFileIds.has(item.id)
          );
          if (!file) return null;
          return v2CardAttachmentSchema.parse({
            id: cardFile.id,
            cardId: cardFile.cardId,
            fileId: cardFile.fileId,
            role: cardFile.role,
            filename: file.filename,
            mimeType: file.mimeType ?? null,
            sizeBytes: file.sizeBytes ?? null,
            processingStatus: file.processingStatus,
            createdAt: cardFile.createdAt
          });
        })
        .filter((attachment): attachment is V2CardAttachment => attachment !== null);
    },

    async createCardAttachment(input) {
      const card = state.cards.find((item) => item.id === input.cardId && !deletedCardIds.has(item.id));
      if (!card) {
        throw new Error("Card not found");
      }

      const timestamp = nowIso();
      const file = {
        id: input.fileId,
        workspaceId: input.workspaceId,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        filename: input.filename,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        sha256: input.sha256 ?? null,
        metadata: {},
        processingStatus: "processed" as const,
        createdBy: input.createdBy ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null
      };
      const cardFile = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        cardId: input.cardId,
        fileId: input.fileId,
        role: input.role ?? "attachment",
        metadata: cloneJson(input.metadata ?? {}),
        createdBy: input.createdBy ?? null,
        createdAt: timestamp,
        deletedAt: null
      };

      state.files.push(file);
      state.cardFiles.push(cardFile);

      return v2CardAttachmentSchema.parse({
        id: cardFile.id,
        cardId: cardFile.cardId,
        fileId: cardFile.fileId,
        role: cardFile.role,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        processingStatus: file.processingStatus,
        createdAt: cardFile.createdAt
      });
    },

    async listConnectionAttachments(connectionId) {
      if (deletedConnectionIds.has(connectionId)) return [];
      const connection = state.connections.find((item) => item.id === connectionId);
      if (!connection) return [];

      return state.connectionFiles
        .filter(
          (connectionFile) =>
            connectionFile.connectionId === connectionId &&
            !deletedConnectionFileIds.has(connectionFile.id)
        )
        .map((connectionFile) => {
          const file = state.files.find(
            (item) => item.id === connectionFile.fileId && !deletedFileIds.has(item.id)
          );
          if (!file) return null;
          return v2ConnectionAttachmentSchema.parse({
            id: connectionFile.id,
            connectionId: connectionFile.connectionId,
            fileId: connectionFile.fileId,
            role: connectionFile.role,
            metadata: cloneJson(connectionFile.metadata ?? {}),
            filename: file.filename,
            mimeType: file.mimeType ?? null,
            sizeBytes: file.sizeBytes ?? null,
            sha256: file.sha256 ?? null,
            processingStatus: file.processingStatus,
            createdAt: connectionFile.createdAt
          });
        })
        .filter((attachment): attachment is V2ConnectionAttachment => attachment !== null);
    },

    async createConnectionAttachment(input) {
      const connection = state.connections.find(
        (item) => item.id === input.connectionId && !deletedConnectionIds.has(item.id)
      );
      if (!connection) {
        throw new Error("Connection not found");
      }

      const timestamp = nowIso();
      const file = {
        id: input.fileId,
        workspaceId: input.workspaceId,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        filename: input.filename,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        sha256: input.sha256 ?? null,
        metadata: {},
        processingStatus: "processed" as const,
        createdBy: input.createdBy ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null
      };
      const connectionFile = {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        connectionId: input.connectionId,
        fileId: input.fileId,
        role: input.role ?? "attachment",
        metadata: cloneJson(input.metadata ?? {}),
        createdBy: input.createdBy ?? null,
        createdAt: timestamp,
        deletedAt: null
      };

      state.files.push(file);
      state.connectionFiles.push(connectionFile);

      return v2ConnectionAttachmentSchema.parse({
        id: connectionFile.id,
        connectionId: connectionFile.connectionId,
        fileId: connectionFile.fileId,
        role: connectionFile.role,
        metadata: connectionFile.metadata,
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
        processingStatus: file.processingStatus,
        createdAt: connectionFile.createdAt
      });
    },

    async getFileForDownload(fileId) {
      const file = state.files.find((item) => item.id === fileId && !deletedFileIds.has(item.id));
      if (!file) return null;

      return {
        fileId: file.id,
        workspaceId: file.workspaceId,
        storageBucket: file.storageBucket,
        storagePath: file.storagePath,
        filename: file.filename,
        mimeType: file.mimeType ?? null,
        sizeBytes: file.sizeBytes ?? null
      };
    },

    async detachCardAttachment(cardId, attachmentId) {
      const cardFile = state.cardFiles.find(
        (item) => item.id === attachmentId && item.cardId === cardId && !deletedCardFileIds.has(item.id)
      );
      if (!cardFile) return false;

      cardFile.deletedAt = nowIso();
      deletedCardFileIds.add(cardFile.id);
      return true;
    },

    async detachConnectionAttachment(connectionId, attachmentId) {
      const connectionFile = state.connectionFiles.find(
        (item) =>
          item.id === attachmentId &&
          item.connectionId === connectionId &&
          !deletedConnectionFileIds.has(item.id)
      );
      if (!connectionFile) return false;

      connectionFile.deletedAt = nowIso();
      deletedConnectionFileIds.add(connectionFile.id);
      return true;
    }
  };
}

export function createV2PostgresRepository(databaseUrl: string): V2Repository {
  const pool = new Pool({ connectionString: databaseUrl });

  async function loadPortsForCardTypes(cardTypeIds: string[]): Promise<Map<string, V2CardTypePort[]>> {
    if (cardTypeIds.length === 0) return new Map();

    const result = await pool.query(
      `
        select *
        from card_type_ports
        where card_type_id = any($1::uuid[])
          and deleted_at is null
        order by card_type_id asc, direction asc, sort_order asc, key asc
      `,
      [cardTypeIds]
    );

    return portsByCardType(result.rows.map(cardTypePortFromRow));
  }

  async function cardTypesFromRows(rows: QueryResultRow[]): Promise<V2CardType[]> {
    const ids = rows.map((row) => String(row.id));
    const groupedPorts = await loadPortsForCardTypes(ids);
    return rows.map((row) => cardTypeFromRow(row, groupedPorts.get(String(row.id)) ?? []));
  }

  async function replaceCardTypePorts(
    workspaceId: string,
    cardTypeId: string,
    ports: V2CardTypePortInput[]
  ): Promise<void> {
    await pool.query(
      `
        update card_type_ports
        set deleted_at = now(),
            updated_at = now()
        where card_type_id = $1
          and deleted_at is null
      `,
      [cardTypeId]
    );

    for (const [index, port] of ports.entries()) {
      await pool.query(
        `
          insert into card_type_ports (
            workspace_id,
            card_type_id,
            key,
            label,
            direction,
            data_type,
            required,
            sort_order
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          workspaceId,
          cardTypeId,
          port.key,
          port.label,
          port.direction,
          port.dataType,
          port.required,
          port.sortOrder ?? index
        ]
      );
    }
  }

  async function findBootstrapResult(
    client: PoolClient,
    userId: string,
    created: boolean
  ): Promise<V2BootstrapSessionResponse | null> {
    const result = await client.query(
      `
        select
          u.id as user_id,
          u.email,
          u.name as user_name,
          u.avatar_url,
          w.id as workspace_id,
          w.name as workspace_name,
          w.slug as workspace_slug,
          w.updated_at as workspace_updated_at,
          wm.role,
          b.id as board_id,
          b.name as board_name,
          b.updated_at as board_updated_at
        from users u
        join workspace_members wm
          on wm.user_id = u.id
          and wm.deleted_at is null
        join workspaces w
          on w.id = wm.workspace_id
          and w.deleted_at is null
        left join lateral (
          select id, name, updated_at
          from boards
          where workspace_id = w.id
            and deleted_at is null
          order by updated_at desc, id asc
          limit 1
        ) b on true
        where u.id = $1
          and u.deleted_at is null
          and w.slug = $2
        order by wm.created_at asc, w.id asc
        limit 1
      `,
      [userId, personalWorkspaceSlug(userId)]
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      created,
      user: {
        id: String(row.user_id),
        email: String(row.email),
        name: String(row.user_name),
        avatarUrl: row.avatar_url ? String(row.avatar_url) : null
      },
      workspace: workspaceSummaryFromRow(row),
      board: row.board_id ? boardSummaryFromRow(row) : null
    };
  }

  async function copyDemoBoard(
    client: PoolClient,
    demoBoardId: string,
    workspaceId: string,
    projectId: string,
    boardId: string
  ): Promise<void> {
    const demoBoardResult = await client.query(
      `select * from boards where id = $1 and deleted_at is null limit 1`,
      [demoBoardId]
    );
    const demoBoard = demoBoardResult.rows[0];
    if (!demoBoard) {
      throw new Error(`Demo board ${demoBoardId} was not found`);
    }

    await client.query(
      `
        insert into boards (
          id, workspace_id, project_id, name,
          viewport_x, viewport_y, viewport_zoom
        )
        values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        boardId,
        workspaceId,
        projectId,
        "Demo board",
        demoBoard.viewport_x,
        demoBoard.viewport_y,
        demoBoard.viewport_zoom
      ]
    );

    const cardTypeMap = new Map<string, string>();
    const cardTypes = await client.query(
      `select * from card_types where workspace_id = $1 and deleted_at is null order by created_at, id`,
      [demoBoard.workspace_id]
    );
    for (const row of cardTypes.rows) {
      const newId = randomUUID();
      cardTypeMap.set(String(row.id), newId);
      await client.query(
        `
          insert into card_types (
            id, workspace_id, key, name, description, default_data,
            schema, default_width, default_height, default_visual_style
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::jsonb)
        `,
        [
          newId,
          workspaceId,
          row.key,
          row.name,
          row.description,
          JSON.stringify(row.default_data),
          JSON.stringify(row.schema),
          row.default_width,
          row.default_height,
          JSON.stringify(row.default_visual_style)
        ]
      );

      const ports = await client.query(
        `select * from card_type_ports where card_type_id = $1 and deleted_at is null order by sort_order, id`,
        [row.id]
      );
      for (const port of ports.rows) {
        await client.query(
          `
            insert into card_type_ports (
              id, workspace_id, card_type_id, key, label,
              direction, data_type, required, sort_order
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            randomUUID(), workspaceId, newId, port.key, port.label,
            port.direction, port.data_type, port.required, port.sort_order
          ]
        );
      }
    }

    const connectionTypeMap = new Map<string, string>();
    const connectionTypes = await client.query(
      `select * from connection_types where workspace_id = $1 and deleted_at is null order by created_at, id`,
      [demoBoard.workspace_id]
    );
    for (const row of connectionTypes.rows) {
      const newId = randomUUID();
      connectionTypeMap.set(String(row.id), newId);
      await client.query(
        `
          insert into connection_types (
            id, workspace_id, key, name, description, schema, default_visual_style
          )
          values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        `,
        [
          newId, workspaceId, row.key, row.name, row.description,
          JSON.stringify(row.schema), JSON.stringify(row.default_visual_style)
        ]
      );
    }

    const cardMap = new Map<string, string>();
    const cards = await client.query(
      `select * from cards where board_id = $1 and deleted_at is null order by created_at, id`,
      [demoBoardId]
    );
    for (const row of cards.rows) {
      const newId = randomUUID();
      const mappedTypeId = cardTypeMap.get(String(row.card_type_id));
      if (!mappedTypeId) throw new Error("Demo card type mapping is incomplete");
      cardMap.set(String(row.id), newId);
      await client.query(
        `
          insert into cards (
            id, workspace_id, board_id, card_type_id, title, description,
            data, position_x, position_y, width, height, visual_style, status
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13)
        `,
        [
          newId, workspaceId, boardId, mappedTypeId, row.title, row.description,
          JSON.stringify(row.data), row.position_x, row.position_y, row.width, row.height,
          JSON.stringify(row.visual_style), row.status
        ]
      );
    }

    const connections = await client.query(
      `select * from connections where board_id = $1 and deleted_at is null order by created_at, id`,
      [demoBoardId]
    );
    for (const row of connections.rows) {
      const sourceCardId = cardMap.get(String(row.source_card_id));
      const targetCardId = cardMap.get(String(row.target_card_id));
      if (!sourceCardId || !targetCardId) throw new Error("Demo connection card mapping is incomplete");
      const connectionTypeId = row.connection_type_id
        ? connectionTypeMap.get(String(row.connection_type_id)) ?? null
        : null;
      await client.query(
        `
          insert into connections (
            id, workspace_id, board_id, connection_type_id,
            source_card_id, target_card_id, source_port_key, target_port_key,
            type, label, title, description, data, visual_style, status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15)
        `,
        [
          randomUUID(), workspaceId, boardId, connectionTypeId,
          sourceCardId, targetCardId, row.source_port_key, row.target_port_key,
          row.type, row.label, row.title, row.description,
          JSON.stringify(row.data), JSON.stringify(row.visual_style), row.status
        ]
      );
    }

    const bindings = await client.query(
      `select * from v2_card_field_bindings where board_id = $1 and deleted_at is null and status = 'active'`,
      [demoBoardId]
    );
    for (const row of bindings.rows) {
      const targetCardId = cardMap.get(String(row.target_card_id));
      const sourceCardId = row.source_card_id ? cardMap.get(String(row.source_card_id)) ?? null : null;
      const sourceCardTypeId = row.source_card_type_id
        ? cardTypeMap.get(String(row.source_card_type_id)) ?? null
        : null;
      if (!targetCardId || (row.source_card_id && !sourceCardId)) {
        throw new Error("Demo linked field mapping is incomplete");
      }
      await client.query(
        `
          insert into v2_card_field_bindings (
            id, workspace_id, board_id, target_card_id, target_field,
            source_mode, connection_direction, source_card_id, source_card_type_id,
            source_card_type_key, source_field_path, on_missing, on_multiple, status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
        `,
        [
          randomUUID(), workspaceId, boardId, targetCardId, row.target_field,
          row.source_mode, row.connection_direction, sourceCardId, sourceCardTypeId,
          row.source_card_type_key, row.source_field_path, row.on_missing, row.on_multiple
        ]
      );
    }
  }

  function roleFromRow(row: QueryResultRow | undefined): V2WorkspaceRole | null {
    return row?.role ? (String(row.role) as V2WorkspaceRole) : null;
  }

  return {
    async healthCheck() {
      await pool.query("select 1");
    },

    async close() {
      await pool.end();
    },

    async bootstrapPersonalWorkspace(input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `
            insert into users (
              id, email, name, avatar_url, auth_provider, auth_subject
            )
            values ($1, $2, $3, $4, $5, $6)
            on conflict (id) do update
            set email = excluded.email,
                name = excluded.name,
                avatar_url = excluded.avatar_url,
                auth_provider = excluded.auth_provider,
                auth_subject = excluded.auth_subject,
                updated_at = now(),
                deleted_at = null
          `,
          [
            input.userId,
            input.email.toLowerCase(),
            input.name,
            input.avatarUrl,
            input.authProvider,
            input.userId
          ]
        );
        await client.query(`select id from users where id = $1 for update`, [input.userId]);

        const existing = await findBootstrapResult(client, input.userId, false);
        if (existing) {
          await client.query("commit");
          return existing;
        }

        const workspaceId = randomUUID();
        const projectId = randomUUID();
        const boardId = randomUUID();
        await client.query(
          `insert into workspaces (id, name, slug, owner_user_id) values ($1, $2, $3, $4)`,
          [
            workspaceId,
            personalWorkspaceName(input.name, input.email),
            personalWorkspaceSlug(input.userId),
            input.userId
          ]
        );
        await client.query(
          `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')`,
          [workspaceId, input.userId]
        );
        await client.query(
          `insert into projects (id, workspace_id, name) values ($1, $2, $3)`,
          [projectId, workspaceId, "Personal"]
        );
        await copyDemoBoard(client, input.demoBoardId, workspaceId, projectId, boardId);

        const created = await findBootstrapResult(client, input.userId, true);
        if (!created) throw new Error("Personal workspace bootstrap did not produce a result");
        await client.query("commit");
        return created;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async listUserWorkspaces(userId) {
      const result = await pool.query(
        `
          select
            w.id as workspace_id,
            w.name as workspace_name,
            w.slug as workspace_slug,
            w.updated_at as workspace_updated_at,
            wm.role
          from workspace_members wm
          join workspaces w on w.id = wm.workspace_id and w.deleted_at is null
          where wm.user_id = $1
            and wm.deleted_at is null
          order by w.updated_at desc, w.id asc
        `,
        [userId]
      );
      return result.rows.map(workspaceSummaryFromRow);
    },

    async listWorkspaceBoards(workspaceId) {
      const result = await pool.query(
        `
          select
            id as board_id,
            workspace_id,
            name as board_name,
            archived_at,
            updated_at as board_updated_at
          from boards
          where workspace_id = $1
            and deleted_at is null
          order by updated_at desc, id asc
        `,
        [workspaceId]
      );
      return result.rows.map(boardSummaryFromRow);
    },

    async createBoard(workspaceId, name) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        let projectResult = await client.query(
          `
            select id
            from projects
            where workspace_id = $1
              and deleted_at is null
            order by created_at asc, id asc
            limit 1
            for update
          `,
          [workspaceId]
        );
        if (!projectResult.rows[0]) {
          projectResult = await client.query(
            `insert into projects (workspace_id, name) values ($1, 'Boards') returning id`,
            [workspaceId]
          );
        }
        const result = await client.query(
          `
            insert into boards (workspace_id, project_id, name)
            values ($1, $2, $3)
            returning id as board_id, workspace_id, name as board_name, archived_at, updated_at as board_updated_at
          `,
          [workspaceId, projectResult.rows[0].id, name]
        );
        await client.query("commit");
        return boardSummaryFromRow(result.rows[0]);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateBoard(boardId, input) {
      const result = await pool.query(
        `
          update boards
          set name = coalesce($2, name),
              archived_at = case
                when $3::boolean is null then archived_at
                when $3 then coalesce(archived_at, now())
                else null
              end,
              updated_at = now()
          where id = $1 and deleted_at is null
          returning id as board_id, workspace_id, name as board_name, archived_at,
                    updated_at as board_updated_at
        `,
        [boardId, input.name ?? null, input.archived ?? null]
      );
      return result.rows[0] ? boardSummaryFromRow(result.rows[0]) : null;
    },

    async duplicateBoard(boardId, input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const sourceResult = await client.query(
          `select * from boards where id = $1 and deleted_at is null for share`,
          [boardId]
        );
        const source = sourceResult.rows[0];
        if (!source) {
          await client.query("rollback");
          return null;
        }
        const createdResult = await client.query(
          `
            insert into boards (
              workspace_id, project_id, name, viewport_x, viewport_y, viewport_zoom
            ) values ($1, $2, $3, $4, $5, $6)
            returning id as board_id, workspace_id, name as board_name, archived_at,
                      updated_at as board_updated_at
          `,
          [
            source.workspace_id,
            source.project_id,
            input.name ?? `${source.name} copy`,
            source.viewport_x,
            source.viewport_y,
            source.viewport_zoom
          ]
        );
        const created = createdResult.rows[0];
        const cards = await client.query(
          `select * from cards where board_id = $1 and deleted_at is null order by created_at, id`,
          [boardId]
        );
        const cardIds = new Map<string, string>();
        for (const card of cards.rows) {
          const copied = await client.query(
            `
              insert into cards (
                workspace_id, board_id, card_type_id, library_entry_id,
                title, description, data, position_x, position_y, width, height,
                visual_style, status
              ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
              returning id
            `,
            [card.workspace_id, created.board_id, card.card_type_id,
             card.library_entry_id, card.title, card.description, card.data,
             card.position_x, card.position_y, card.width, card.height,
             card.visual_style, card.status]
          );
          cardIds.set(String(card.id), String(copied.rows[0].id));
        }
        const connections = await client.query(
          `select * from connections where board_id = $1 and deleted_at is null order by created_at, id`,
          [boardId]
        );
        for (const connection of connections.rows) {
          const sourceCardId = cardIds.get(String(connection.source_card_id));
          const targetCardId = cardIds.get(String(connection.target_card_id));
          if (!sourceCardId || !targetCardId) continue;
          await client.query(
            `
              insert into connections (
                workspace_id, board_id, connection_type_id, source_card_id, target_card_id,
                source_port_key, target_port_key, title, description, data, visual_style,
                type, label, status
              ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            `,
            [connection.workspace_id, created.board_id, connection.connection_type_id,
             sourceCardId, targetCardId, connection.source_port_key, connection.target_port_key,
             connection.title, connection.description, connection.data, connection.visual_style,
             connection.type, connection.label, connection.status]
          );
        }
        const bindings = await client.query(
          `select * from v2_card_field_bindings where board_id = $1 and deleted_at is null`,
          [boardId]
        );
        for (const binding of bindings.rows) {
          const targetCardId = cardIds.get(String(binding.target_card_id));
          const sourceCardId = binding.source_card_id
            ? cardIds.get(String(binding.source_card_id)) ?? null
            : null;
          if (!targetCardId) continue;
          await client.query(
            `
              insert into v2_card_field_bindings (
                workspace_id, board_id, target_card_id, target_field, source_mode,
                connection_direction, source_card_id, source_card_type_id, source_card_type_key,
                source_field_path, on_missing, on_multiple, status
              ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            `,
            [binding.workspace_id, created.board_id, targetCardId, binding.target_field,
             binding.source_mode, binding.connection_direction, sourceCardId, binding.source_card_type_id,
             binding.source_card_type_key, binding.source_field_path, binding.on_missing,
             binding.on_multiple, binding.status]
          );
        }
        await client.query("commit");
        return boardSummaryFromRow(created);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteBoard(boardId) {
      const result = await pool.query(
        `update boards set deleted_at = now(), updated_at = now()
         where id = $1 and deleted_at is null`,
        [boardId]
      );
      return (result.rowCount ?? 0) === 1;
    },

    async deleteUserData(userId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `update workspaces set deleted_at = now(), updated_at = now()
           where owner_user_id = $1 and deleted_at is null`,
          [userId]
        );
        await client.query(
          `update workspace_members set deleted_at = now(), updated_at = now()
           where user_id = $1 and deleted_at is null`,
          [userId]
        );
        const result = await client.query(
          `update users set deleted_at = now(), updated_at = now()
           where id = $1 and deleted_at is null`,
          [userId]
        );
        await client.query("commit");
        return (result.rowCount ?? 0) === 1;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async getWorkspaceRole(userId, workspaceId) {
      const result = await pool.query(
        `
          select wm.role
          from workspace_members wm
          join workspaces w on w.id = wm.workspace_id and w.deleted_at is null
          where wm.user_id = $1
            and wm.workspace_id = $2
            and wm.deleted_at is null
          limit 1
        `,
        [userId, workspaceId]
      );

      return roleFromRow(result.rows[0]);
    },

    async getBoardRole(userId, boardId) {
      const result = await pool.query(
        `
          select wm.role
          from boards b
          join workspace_members wm on wm.workspace_id = b.workspace_id
          where wm.user_id = $1
            and b.id = $2
            and b.deleted_at is null
            and wm.deleted_at is null
          limit 1
        `,
        [userId, boardId]
      );

      return roleFromRow(result.rows[0]);
    },

    async getCardRole(userId, cardId) {
      const result = await pool.query(
        `
          select wm.role
          from cards c
          join workspace_members wm on wm.workspace_id = c.workspace_id
          where wm.user_id = $1
            and c.id = $2
            and c.deleted_at is null
            and wm.deleted_at is null
          limit 1
        `,
        [userId, cardId]
      );

      return roleFromRow(result.rows[0]);
    },

    async getConnectionRole(userId, connectionId) {
      const result = await pool.query(
        `
          select wm.role
          from connections c
          join workspace_members wm on wm.workspace_id = c.workspace_id
          where wm.user_id = $1
            and c.id = $2
            and c.deleted_at is null
            and wm.deleted_at is null
          limit 1
        `,
        [userId, connectionId]
      );

      return roleFromRow(result.rows[0]);
    },

    async getBoardDetail(boardId) {
      const boardResult = await pool.query(
        `
          select
            w.id as workspace_id,
            w.name as workspace_name,
            w.slug as workspace_slug,
            w.created_at as workspace_created_at,
            w.updated_at as workspace_updated_at,
            p.id as project_id,
            p.name as project_name,
            p.created_at as project_created_at,
            p.updated_at as project_updated_at,
            b.id as board_id,
            b.name as board_name,
            b.viewport_x,
            b.viewport_y,
            b.viewport_zoom,
            b.created_at as board_created_at,
            b.updated_at as board_updated_at
          from boards b
          join projects p on p.id = b.project_id and p.deleted_at is null
          join workspaces w on w.id = b.workspace_id and w.deleted_at is null
          where b.id = $1
            and b.deleted_at is null
          limit 1
        `,
        [boardId]
      );
      const boardRow = boardResult.rows[0];
      if (!boardRow) return null;

      const cardsResult = await pool.query(
        `
          select
            ${resolvedCardColumns},
            (
              select count(*)::int
              from card_files cf
              join files f on f.id = cf.file_id and f.deleted_at is null
              where cf.card_id = c.id
                and cf.deleted_at is null
            ) as attachment_count
          from cards c
          ${resolvedCardJoin}
          where c.board_id = $1
            and c.deleted_at is null
          order by c.created_at asc, c.id asc
        `,
        [boardId]
      );
      const cards = cardsResult.rows.map(cardFromRow);

      const cardTypesResult = await pool.query(
        `
          select *
          from card_types
          where workspace_id = $1
            and deleted_at is null
          order by name asc, id asc
        `,
        [String(boardRow.workspace_id)]
      );
      const cardTypes = await cardTypesFromRows(cardTypesResult.rows);

      const connectionTypesResult = await pool.query(
        `
          select *
          from connection_types
          where workspace_id = $1
            and deleted_at is null
          order by name asc, id asc
        `,
        [String(boardRow.workspace_id)]
      );
      const connectionTypes = connectionTypesResult.rows.map(connectionTypeFromRow);

      const connectionsResult = await pool.query(
        `
          select c.*
          from connections c
          join cards source_card
            on source_card.id = c.source_card_id
            and source_card.board_id = c.board_id
            and source_card.deleted_at is null
          join cards target_card
            on target_card.id = c.target_card_id
            and target_card.board_id = c.board_id
            and target_card.deleted_at is null
          where c.board_id = $1
            and c.deleted_at is null
          order by c.created_at asc, c.id asc
        `,
        [boardId]
      );

      return v2BoardDetailSchema.parse({
        workspace: workspaceFromRow(boardRow),
        project: projectFromRow(boardRow),
        board: boardFromRow(boardRow),
        cardTypes,
        connectionTypes,
        cards,
        cardAttachmentCounts: Object.fromEntries(
          cardsResult.rows.map((row) => [String(row.id), Number(row.attachment_count ?? 0)])
        ),
        connections: connectionsResult.rows.map(connectionFromRow)
      });
    },

    async getBoard(boardId) {
      const result = await pool.query(
        `
          select *
          from boards
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [boardId]
      );
      const row = result.rows[0];
      return row ? boardFromRow(row) : null;
    },

    async updateBoardLayout(boardId, input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        for (const update of input.cards) {
          const result = await client.query(
            `
              update cards
              set position_x = $3, position_y = $4, updated_at = now()
              where id = $1 and board_id = $2 and deleted_at is null
            `,
            [update.id, boardId, update.position.x, update.position.y]
          );
          if ((result.rowCount ?? 0) !== 1) {
            await client.query("rollback");
            return null;
          }
        }
        for (const update of input.connections) {
          const result = await client.query(
            `
              update connections
              set visual_style = $3::jsonb, updated_at = now()
              where id = $1 and board_id = $2 and deleted_at is null
            `,
            [update.id, boardId, JSON.stringify(update.visualStyle)]
          );
          if ((result.rowCount ?? 0) !== 1) {
            await client.query("rollback");
            return null;
          }
        }
        await client.query("commit");
        return {
          updatedCards: input.cards.length,
          updatedConnections: input.connections.length
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async listCardTypes(workspaceId) {
      const result = await pool.query(
        `
          select *
          from card_types
          where workspace_id = $1
            and deleted_at is null
          order by name asc, id asc
        `,
        [workspaceId]
      );

      return cardTypesFromRows(result.rows);
    },

    async getCardType(cardTypeId) {
      const result = await pool.query(
        `
          select *
          from card_types
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [cardTypeId]
      );
      const row = result.rows[0];
      if (!row) return null;

      const ports = await loadPortsForCardTypes([cardTypeId]);
      return cardTypeFromRow(row, ports.get(cardTypeId) ?? []);
    },

    async listConnectionTypes(workspaceId) {
      const result = await pool.query(
        `
          select *
          from connection_types
          where workspace_id = $1
            and deleted_at is null
          order by name asc, id asc
        `,
        [workspaceId]
      );

      return result.rows.map(connectionTypeFromRow);
    },

    async getConnectionType(connectionTypeId) {
      const result = await pool.query(
        `
          select *
          from connection_types
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [connectionTypeId]
      );
      const row = result.rows[0];
      return row ? connectionTypeFromRow(row) : null;
    },

    async createConnectionType(input) {
      const result = await pool.query(
        `
          insert into connection_types (
            workspace_id,
            key,
            name,
            description,
            schema,
            default_visual_style
          )
          values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
          returning *
        `,
        [
          input.workspaceId,
          input.key,
          input.name,
          input.description,
          JSON.stringify(input.schema),
          JSON.stringify(input.defaultVisualStyle)
        ]
      );
      return connectionTypeFromRow(result.rows[0]);
    },

    async updateConnectionType(connectionTypeId, input) {
      const existingResult = await pool.query(
        `
          select *
          from connection_types
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [connectionTypeId]
      );
      const existingRow = existingResult.rows[0];
      if (!existingRow) return null;
      const existing = connectionTypeFromRow(existingRow);

      const result = await pool.query(
        `
          update connection_types
          set key = $2,
              name = $3,
              description = $4,
              schema = $5::jsonb,
              default_visual_style = $6::jsonb,
              updated_at = now()
          where id = $1
            and deleted_at is null
          returning *
        `,
        [
          connectionTypeId,
          input.key ?? existing.key,
          input.name ?? existing.name,
          input.description !== undefined ? input.description : existing.description,
          JSON.stringify(input.schema ?? existing.schema),
          JSON.stringify(input.defaultVisualStyle ?? existing.defaultVisualStyle)
        ]
      );
      const row = result.rows[0];
      return row ? connectionTypeFromRow(row) : null;
    },

    async createCardType(input) {
      const result = await pool.query(
        `
          insert into card_types (
            workspace_id,
            key,
            name,
            description,
            schema,
            default_width,
            default_height,
            default_visual_style
          )
          values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb)
          returning *
        `,
        [
          input.workspaceId,
          input.key,
          input.name,
          input.description,
          JSON.stringify(input.schema),
          input.defaultSize.width,
          input.defaultSize.height,
          JSON.stringify(input.defaultVisualStyle)
        ]
      );
      const row = result.rows[0];
      await replaceCardTypePorts(input.workspaceId, String(row.id), input.ports);
      const ports = await loadPortsForCardTypes([String(row.id)]);
      return cardTypeFromRow(row, ports.get(String(row.id)) ?? []);
    },

    async updateCardType(cardTypeId, input) {
      const existingResult = await pool.query(
        `
          select *
          from card_types
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [cardTypeId]
      );
      const existingRow = existingResult.rows[0];
      if (!existingRow) return null;
      const existing = cardTypeFromRow(existingRow);

      const result = await pool.query(
        `
          update card_types
          set key = $2,
              name = $3,
              description = $4,
              schema = $5::jsonb,
              default_width = $6,
              default_height = $7,
              default_visual_style = $8::jsonb,
              updated_at = now()
          where id = $1
            and deleted_at is null
          returning *
        `,
        [
          cardTypeId,
          input.key ?? existing.key,
          input.name ?? existing.name,
          input.description ?? existing.description,
          JSON.stringify(input.schema ?? existing.schema),
          (input.defaultSize ?? existing.defaultSize).width,
          (input.defaultSize ?? existing.defaultSize).height,
          JSON.stringify(input.defaultVisualStyle ?? existing.defaultVisualStyle)
        ]
      );
      const row = result.rows[0];
      if (!row) return null;

      if (input.ports !== undefined) {
        await replaceCardTypePorts(existing.workspaceId, cardTypeId, input.ports);
      }
      const ports = await loadPortsForCardTypes([cardTypeId]);
      return cardTypeFromRow(row, ports.get(cardTypeId) ?? []);
    },

    async updateCardTypeSchema(cardTypeId, schema) {
      const result = await pool.query(
        `
          update card_types
          set schema = $2::jsonb,
              updated_at = now()
          where id = $1
            and deleted_at is null
          returning *
        `,
        [cardTypeId, JSON.stringify(schema)]
      );
      const row = result.rows[0];
      if (!row) return null;

      const ports = await loadPortsForCardTypes([cardTypeId]);
      return cardTypeFromRow(row, ports.get(cardTypeId) ?? []);
    },

    async deleteCardType(cardTypeId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const typeResult = await client.query(
          `
            select id
            from card_types
            where id = $1
              and deleted_at is null
            for update
          `,
          [cardTypeId]
        );
        if (!typeResult.rows[0]) {
          await client.query("rollback");
          return { status: "not_found", cardCount: 0, libraryEntryCount: 0 };
        }

        const countResult = await client.query(
          `
            select
              (select count(*)::int
                 from cards
                where card_type_id = $1 and deleted_at is null) as card_count,
              (select count(*)::int
                 from card_library_entries
                where card_type_id = $1 and deleted_at is null) as library_entry_count
          `,
          [cardTypeId]
        );
        const cardCount = Number(countResult.rows[0]?.card_count ?? 0);
        const libraryEntryCount = Number(countResult.rows[0]?.library_entry_count ?? 0);
        if (cardCount > 0 || libraryEntryCount > 0) {
          await client.query("rollback");
          return { status: "in_use", cardCount, libraryEntryCount };
        }

        await client.query(
          `
            update card_types
            set deleted_at = now(),
                updated_at = now()
            where id = $1
              and deleted_at is null
          `,
          [cardTypeId]
        );
        await client.query("commit");
        return { status: "deleted", cardCount: 0, libraryEntryCount: 0 };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async listCardLibraryEntries(workspaceId, cardTypeId, query) {
      const values: unknown[] = [workspaceId, cardTypeId];
      const filters = [
        "e.workspace_id = $1",
        "e.card_type_id = $2",
        "e.deleted_at is null"
      ];

      if (query.status === "active") filters.push("e.archived_at is null");
      if (query.status === "archived") filters.push("e.archived_at is not null");
      if (query.query) {
        values.push(`%${query.query}%`);
        const parameter = `$${values.length}`;
        filters.push(
          `(e.title ilike ${parameter} or e.description ilike ${parameter} or e.data::text ilike ${parameter})`
        );
      }

      const sortExpression = query.sort === "updatedAt" ? "e.updated_at" : "lower(e.title)";
      const direction = query.direction === "desc" ? "desc" : "asc";
      const comparator = direction === "desc" ? "<" : ">";
      if (query.cursor) {
        const cursorValues = [...values, query.cursor];
        const cursorResult = await pool.query(
          `
            select lower(e.title) as title_sort, e.updated_at
            from card_library_entries e
            where ${filters.join("\n              and ")}
              and e.id = $${cursorValues.length}::uuid
            limit 1
          `,
          cursorValues
        );
        const cursor = cursorResult.rows[0];
        if (!cursor) return null;

        values.push(query.sort === "updatedAt" ? cursor.updated_at : cursor.title_sort);
        const sortParameter = `$${values.length}`;
        values.push(query.cursor);
        const idParameter = `$${values.length}`;
        filters.push(
          `(${sortExpression} ${comparator} ${sortParameter} or (${sortExpression} = ${sortParameter} and e.id ${comparator} ${idParameter}::uuid))`
        );
      }

      values.push(query.limit + 1);
      const result = await pool.query(
        `
          select e.*,
                 (select count(*)::int
                    from cards c
                   where c.library_entry_id = e.id
                     and c.deleted_at is null) as usage_count
          from card_library_entries e
          where ${filters.join("\n            and ")}
          order by ${sortExpression} ${direction}, e.id ${direction}
          limit $${values.length}
        `,
        values
      );
      const hasMore = result.rows.length > query.limit;
      const rows = hasMore ? result.rows.slice(0, query.limit) : result.rows;
      const entries = rows.map(cardLibraryEntryFromRow);
      return {
        entries,
        nextCursor: hasMore ? entries.at(-1)?.id ?? null : null
      };
    },

    async getCardLibraryEntry(libraryEntryId) {
      const result = await pool.query(
        `
          select e.*,
                 (select count(*)::int
                    from cards c
                   where c.library_entry_id = e.id
                     and c.deleted_at is null) as usage_count
          from card_library_entries e
          where e.id = $1
            and e.deleted_at is null
          limit 1
        `,
        [libraryEntryId]
      );
      return result.rows[0] ? cardLibraryEntryFromRow(result.rows[0]) : null;
    },

    async createCardLibraryEntry(input) {
      const result = await pool.query(
        `
          insert into card_library_entries (
            workspace_id, card_type_id, title, description, data
          ) values ($1, $2, $3, $4, $5::jsonb)
          returning *
        `,
        [
          input.workspaceId,
          input.cardTypeId,
          input.title,
          input.description,
          JSON.stringify(input.data)
        ]
      );
      return cardLibraryEntryFromRow({ ...result.rows[0], usage_count: 0 });
    },

    async updateCardLibraryEntry(libraryEntryId, input) {
      const result = await pool.query(
        `
          update card_library_entries
          set title = case when $2::boolean then $3 else title end,
              description = case when $4::boolean then $5 else description end,
              data = case when $6::boolean then $7::jsonb else data end,
              archived_at = case
                when $8::boolean then case when $9::boolean then now() else null end
                else archived_at
              end
          where id = $1
            and version = $10
            and deleted_at is null
          returning *
        `,
        [
          libraryEntryId,
          input.title !== undefined,
          input.title ?? null,
          input.description !== undefined,
          input.description ?? null,
          input.data !== undefined,
          input.data === undefined ? null : JSON.stringify(input.data),
          input.archived !== undefined,
          input.archived ?? false,
          input.expectedVersion
        ]
      );
      const row = result.rows[0];
      if (row) {
        const usageResult = await pool.query(
          `select count(*)::int as usage_count from cards where library_entry_id = $1 and deleted_at is null`,
          [libraryEntryId]
        );
        return {
          status: "updated",
          entry: cardLibraryEntryFromRow({
            ...row,
            usage_count: usageResult.rows[0]?.usage_count ?? 0
          })
        };
      }

      const current = await this.getCardLibraryEntry?.(libraryEntryId);
      return current
        ? { status: "version_conflict", entry: current }
        : { status: "not_found" };
    },

    async deleteCardLibraryEntry(libraryEntryId, expectedVersion) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const entryResult = await client.query(
          `select * from card_library_entries where id = $1 and deleted_at is null for update`,
          [libraryEntryId]
        );
        const entry = entryResult.rows[0];
        if (!entry) {
          await client.query("rollback");
          return { status: "not_found" };
        }
        const usageResult = await client.query(
          `select count(*)::int as usage_count from cards where library_entry_id = $1 and deleted_at is null`,
          [libraryEntryId]
        );
        const usageCount = Number(usageResult.rows[0]?.usage_count ?? 0);
        if (Number(entry.version) !== expectedVersion) {
          await client.query("rollback");
          return {
            status: "version_conflict",
            entry: cardLibraryEntryFromRow({ ...entry, usage_count: usageCount })
          };
        }
        if (usageCount > 0) {
          await client.query("rollback");
          return { status: "in_use", usageCount };
        }
        await client.query(
          `update card_library_entries set deleted_at = now() where id = $1`,
          [libraryEntryId]
        );
        await client.query("commit");
        return { status: "deleted" };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async getCard(cardId) {
      const result = await pool.query(
        `
          select ${resolvedCardColumns}
          from cards c
          ${resolvedCardJoin}
          where c.id = $1
            and c.deleted_at is null
          limit 1
        `,
        [cardId]
      );
      const row = result.rows[0];
      return row ? cardFromRow(row) : null;
    },

    async createCard(input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        if (input.libraryEntryId) {
          const entryResult = await client.query(
            `
              select id
              from card_library_entries
              where id = $1
                and workspace_id = $2
                and card_type_id = $3
                and archived_at is null
                and deleted_at is null
              for share
            `,
            [input.libraryEntryId, input.workspaceId, input.cardTypeId]
          );
          if (!entryResult.rows[0]) {
            throw Object.assign(new Error("Card library entry is unavailable"), {
              code: "23503"
            });
          }
        }

        const result = await client.query(
          `
            insert into cards (
              workspace_id, board_id, card_type_id, library_entry_id,
              title, description, data, position_x, position_y, width, height,
              visual_style, status
            ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13)
            returning id
          `,
          [
            input.workspaceId,
            input.boardId,
            input.cardTypeId,
            input.libraryEntryId ?? null,
            input.title,
            input.description,
            JSON.stringify(input.data),
            input.position.x,
            input.position.y,
            input.size.width,
            input.size.height,
            JSON.stringify(input.visualStyle ?? {}),
            input.status
          ]
        );
        const cardResult = await client.query(
          `
            select ${resolvedCardColumns}
            from cards c
            ${resolvedCardJoin}
            where c.id = $1
              and c.deleted_at is null
            limit 1
          `,
          [result.rows[0].id]
        );
        await client.query("commit");
        return cardFromRow(cardResult.rows[0]);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async duplicateCard(cardId) {
      const result = await pool.query(
        `
          insert into cards (
            workspace_id,
            board_id,
            card_type_id,
            library_entry_id,
            title,
            description,
            data,
            position_x,
            position_y,
            width,
            height,
            visual_style,
            status
          )
          select
            workspace_id,
            board_id,
            card_type_id,
            library_entry_id,
            title,
            description,
            data,
            position_x + 40,
            position_y + 40,
            width,
            height,
            visual_style,
            'active'
          from cards
          where id = $1
            and deleted_at is null
          returning id
        `,
        [cardId]
      );

      const row = result.rows[0];
      return row ? this.getCard(String(row.id)) : null;
    },

    async updateCard(cardId, input) {
      const result = await pool.query(
        `
          update cards
          set title = coalesce($2, title),
              description = coalesce($3, description),
              data = coalesce($4::jsonb, data),
              position_x = coalesce($5, position_x),
              position_y = coalesce($6, position_y),
              width = coalesce($7, width),
              height = coalesce($8, height),
              visual_style = coalesce($9::jsonb, visual_style),
              status = coalesce($10, status),
              updated_at = now()
          where id = $1
            and deleted_at is null
          returning id
        `,
        [
          cardId,
          input.title ?? null,
          input.description ?? null,
          input.data === undefined ? null : JSON.stringify(input.data),
          input.position?.x ?? null,
          input.position?.y ?? null,
          input.size?.width ?? null,
          input.size?.height ?? null,
          input.visualStyle === undefined ? null : JSON.stringify(input.visualStyle),
          input.status ?? null
        ]
      );

      const row = result.rows[0];
      return row ? this.getCard(String(row.id)) : null;
    },

    async setCardLibraryEntry(cardId, libraryEntryId, expectedLibraryEntryId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const cardResult = await client.query(
          `
            select ${resolvedCardColumns}
            from cards c
            ${resolvedCardJoin}
            where c.id = $1
              and c.deleted_at is null
            for update of c
          `,
          [cardId]
        );
        const cardRow = cardResult.rows[0];
        if (!cardRow) {
          await client.query("rollback");
          return { status: "card_not_found" };
        }
        const currentLibraryEntryId = cardRow.library_entry_id
          ? String(cardRow.library_entry_id)
          : null;
        if (currentLibraryEntryId !== expectedLibraryEntryId) {
          await client.query("rollback");
          return { status: "conflict", card: cardFromRow(cardRow) };
        }

        if (libraryEntryId !== null) {
          const entryResult = await client.query(
            `
              select id
              from card_library_entries
              where id = $1
                and workspace_id = $2
                and card_type_id = $3
                and archived_at is null
                and deleted_at is null
              for share
            `,
            [libraryEntryId, cardRow.workspace_id, cardRow.card_type_id]
          );
          if (!entryResult.rows[0]) {
            await client.query("rollback");
            return { status: "entry_not_found" };
          }
        }

        const snapshotOnUnlink = libraryEntryId === null && currentLibraryEntryId !== null;
        await client.query(
          `
            update cards
            set library_entry_id = $2,
                title = case when $3 then $4 else title end,
                description = case when $3 then $5 else description end,
                data = case when $3 then $6::jsonb else data end,
                updated_at = now()
            where id = $1
          `,
          [
            cardId,
            libraryEntryId,
            snapshotOnUnlink,
            cardRow.resolved_title,
            cardRow.resolved_description,
            JSON.stringify(asObject(cardRow.resolved_data))
          ]
        );
        const updatedResult = await client.query(
          `
            select ${resolvedCardColumns}
            from cards c
            ${resolvedCardJoin}
            where c.id = $1
              and c.deleted_at is null
            limit 1
          `,
          [cardId]
        );
        await client.query("commit");
        return { status: "updated", card: cardFromRow(updatedResult.rows[0]) };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteCard(cardId) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await client.query(
          `
            update cards
            set deleted_at = now(),
                updated_at = now()
            where id = $1
              and deleted_at is null
          `,
          [cardId]
        );

        if ((result.rowCount ?? 0) === 0) {
          await client.query("rollback");
          return false;
        }

        await client.query(
          `
            update connections
            set deleted_at = now(),
                updated_at = now()
            where deleted_at is null
              and (source_card_id = $1 or target_card_id = $1)
          `,
          [cardId]
        );

        await client.query("commit");
        return true;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async getConnection(connectionId) {
      const result = await pool.query(
        `
          select *
          from connections
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [connectionId]
      );
      const row = result.rows[0];
      return row ? connectionFromRow(row) : null;
    },

    async createConnection(input) {
      const result = await pool.query(
        `
          insert into connections (
            workspace_id,
            board_id,
            connection_type_id,
            source_card_id,
            target_card_id,
            source_port_key,
            target_port_key,
            type,
            label,
            title,
            data,
            visual_style,
            status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)
          returning *
        `,
        [
          input.workspaceId,
          input.boardId,
          input.connectionTypeId ?? null,
          input.sourceCardId,
          input.targetCardId,
          input.sourcePortKey,
          input.targetPortKey,
          input.type,
          input.label,
          input.title ?? null,
          JSON.stringify(input.data ?? {}),
          JSON.stringify(input.visualStyle ?? {}),
          input.status
        ]
      );

      return connectionFromRow(result.rows[0] as QueryResultRow);
    },

    async updateConnection(connectionId, input) {
      const existing = await this.getConnection(connectionId);
      if (!existing) return null;

      const next = {
        title: input.title !== undefined ? input.title?.trim() || null : existing.title,
        description: input.description !== undefined ? input.description ?? null : existing.description,
        connectionTypeId:
          input.connectionTypeId !== undefined ? input.connectionTypeId : existing.connectionTypeId,
        sourceCardId: input.sourceCardId ?? existing.sourceCardId,
        targetCardId: input.targetCardId ?? existing.targetCardId,
        sourcePortKey: input.sourcePortKey ?? existing.sourcePortKey,
        targetPortKey: input.targetPortKey ?? existing.targetPortKey,
        data: input.data !== undefined ? input.data : existing.data,
        visualStyle:
          input.visualStyle !== undefined
            ? { ...existing.visualStyle, ...input.visualStyle }
            : existing.visualStyle,
        status: input.status ?? existing.status
      };

      const result = await pool.query(
        `
          update connections
          set title = $2,
              description = $3,
              connection_type_id = $4,
              source_card_id = $5,
              target_card_id = $6,
              source_port_key = $7,
              target_port_key = $8,
              data = $9::jsonb,
              visual_style = $10::jsonb,
              status = $11,
              updated_at = now()
          where id = $1
            and deleted_at is null
          returning *
        `,
        [
          connectionId,
          next.title,
          next.description,
          next.connectionTypeId,
          next.sourceCardId,
          next.targetCardId,
          next.sourcePortKey,
          next.targetPortKey,
          JSON.stringify(next.data),
          JSON.stringify(next.visualStyle),
          next.status
        ]
      );

      const row = result.rows[0];
      return row ? connectionFromRow(row) : null;
    },

    async deleteConnection(connectionId) {
      const result = await pool.query(
        `
          update connections
          set deleted_at = now()
          where id = $1
            and deleted_at is null
        `,
        [connectionId]
      );

      return (result.rowCount ?? 0) > 0;
    },

    async listLinkedFieldBindings(boardId) {
      const result = await pool.query(
        `
          select *
          from v2_card_field_bindings
          where board_id = $1
            and status = 'active'
            and deleted_at is null
          order by created_at asc, id asc
        `,
        [boardId]
      );

      return result.rows.map(linkedFieldBindingFromRow);
    },

    async getLinkedFieldBinding(bindingId) {
      const result = await pool.query(
        `
          select *
          from v2_card_field_bindings
          where id = $1
            and status = 'active'
            and deleted_at is null
          limit 1
        `,
        [bindingId]
      );
      const row = result.rows[0];
      return row ? linkedFieldBindingFromRow(row) : null;
    },

    async createLinkedFieldBinding(input) {
      const result = await pool.query(
        `
          insert into v2_card_field_bindings (
            workspace_id,
            board_id,
            target_card_id,
            target_field,
            source_mode,
            connection_direction,
            source_card_id,
            source_card_type_id,
            source_card_type_key,
            source_field_path,
            on_missing,
            on_multiple,
            status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          returning *
        `,
        [
          input.workspaceId,
          input.boardId,
          input.targetCardId,
          input.targetField,
          input.sourceMode,
          input.direction,
          input.sourceCardId ?? null,
          input.sourceCardTypeId ?? null,
          input.sourceCardTypeKey ?? null,
          input.sourceFieldPath,
          input.onMissing,
          input.onMultiple,
          input.status
        ]
      );

      return linkedFieldBindingFromRow(result.rows[0] as QueryResultRow);
    },

    async updateLinkedFieldBinding(bindingId, input) {
      const existing = await this.getLinkedFieldBinding!(bindingId);
      if (!existing) return null;

      const next = {
        targetCardId: input.targetCardId ?? existing.targetCardId,
        targetField: input.targetField ?? existing.targetField,
        sourceMode: input.sourceMode ?? existing.sourceMode,
        direction: input.direction ?? existing.direction,
        sourceCardId: input.sourceCardId !== undefined ? input.sourceCardId : existing.sourceCardId ?? null,
        sourceCardTypeId:
          input.sourceCardTypeId !== undefined ? input.sourceCardTypeId : existing.sourceCardTypeId ?? null,
        sourceCardTypeKey:
          input.sourceCardTypeKey !== undefined ? input.sourceCardTypeKey : existing.sourceCardTypeKey ?? null,
        sourceFieldPath: input.sourceFieldPath ?? existing.sourceFieldPath,
        onMissing: input.onMissing ?? existing.onMissing,
        onMultiple: input.onMultiple ?? existing.onMultiple
      };

      const result = await pool.query(
        `
          update v2_card_field_bindings
          set target_card_id = $2,
              target_field = $3,
              source_mode = $4,
              connection_direction = $5,
              source_card_id = $6,
              source_card_type_id = $7,
              source_card_type_key = $8,
              source_field_path = $9,
              on_missing = $10,
              on_multiple = $11,
              updated_at = now()
          where id = $1
            and status = 'active'
            and deleted_at is null
          returning *
        `,
        [
          bindingId,
          next.targetCardId,
          next.targetField,
          next.sourceMode,
          next.direction,
          next.sourceCardId,
          next.sourceCardTypeId,
          next.sourceCardTypeKey,
          next.sourceFieldPath,
          next.onMissing,
          next.onMultiple
        ]
      );

      const row = result.rows[0];
      return row ? linkedFieldBindingFromRow(row) : null;
    },

    async deleteLinkedFieldBinding(bindingId) {
      const result = await pool.query(
        `
          update v2_card_field_bindings
          set status = 'deleted',
              deleted_at = now(),
              updated_at = now()
          where id = $1
            and status = 'active'
            and deleted_at is null
        `,
        [bindingId]
      );

      return (result.rowCount ?? 0) > 0;
    },

    async listCardAttachments(cardId) {
      const result = await pool.query(
        `
          select
            cf.id as card_file_id,
            cf.card_id,
            cf.file_id,
            cf.role,
            cf.created_at,
            f.filename,
            f.mime_type,
            f.size_bytes,
            f.processing_status
          from card_files cf
          join files f
            on f.id = cf.file_id
            and f.deleted_at is null
          where cf.card_id = $1
            and cf.deleted_at is null
          order by cf.created_at asc, cf.id asc
        `,
        [cardId]
      );

      return result.rows.map(attachmentFromRow);
    },

    async createCardAttachment(input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const fileResult = await client.query(
          `
            insert into files (
              id,
              workspace_id,
              storage_bucket,
              storage_path,
              filename,
              mime_type,
              size_bytes,
              sha256,
              metadata,
              processing_status,
              processing_error,
              created_by
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, 'processed', null, $9)
            returning *
          `,
          [
            input.fileId,
            input.workspaceId,
            input.storageBucket,
            input.storagePath,
            input.filename,
            input.mimeType ?? null,
            input.sizeBytes ?? null,
            input.sha256 ?? null,
            input.createdBy ?? null
          ]
        );

        const cardFileResult = await client.query(
          `
            insert into card_files (
              workspace_id,
              card_id,
              file_id,
              role,
              metadata,
              created_by
            )
            values ($1, $2, $3, $4, $5::jsonb, $6)
            returning *
          `,
          [
            input.workspaceId,
            input.cardId,
            input.fileId,
            input.role ?? "attachment",
            JSON.stringify(input.metadata ?? {}),
            input.createdBy ?? null
          ]
        );

        await client.query("commit");

        const fileRow = fileResult.rows[0] as QueryResultRow;
        const cardFileRow = cardFileResult.rows[0] as QueryResultRow;
        return v2CardAttachmentSchema.parse({
          id: String(cardFileRow.id),
          cardId: String(cardFileRow.card_id),
          fileId: String(cardFileRow.file_id),
          role: String(cardFileRow.role),
          filename: String(fileRow.filename),
          mimeType: fileRow.mime_type === null ? null : String(fileRow.mime_type),
          sizeBytes: fileRow.size_bytes === null ? null : Number(fileRow.size_bytes),
          processingStatus: fileRow.processing_status,
          createdAt: toIso(cardFileRow.created_at)
        });
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async listConnectionAttachments(connectionId) {
      const result = await pool.query(
        `
          select
            cf.id as connection_file_id,
            cf.connection_id,
            cf.file_id,
            cf.role,
            cf.metadata,
            cf.created_at,
            f.filename,
            f.mime_type,
            f.size_bytes,
            f.sha256,
            f.processing_status
          from connection_files cf
          join files f
            on f.id = cf.file_id
            and f.deleted_at is null
          where cf.connection_id = $1
            and cf.deleted_at is null
          order by cf.created_at asc, cf.id asc
        `,
        [connectionId]
      );

      return result.rows.map(connectionAttachmentFromRow);
    },

    async createConnectionAttachment(input) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const fileResult = await client.query(
          `
            insert into files (
              id,
              workspace_id,
              storage_bucket,
              storage_path,
              filename,
              mime_type,
              size_bytes,
              sha256,
              metadata,
              processing_status,
              processing_error,
              created_by
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, 'processed', null, $9)
            returning *
          `,
          [
            input.fileId,
            input.workspaceId,
            input.storageBucket,
            input.storagePath,
            input.filename,
            input.mimeType ?? null,
            input.sizeBytes ?? null,
            input.sha256 ?? null,
            input.createdBy ?? null
          ]
        );

        const connectionFileResult = await client.query(
          `
            insert into connection_files (
              workspace_id,
              connection_id,
              file_id,
              role,
              metadata,
              created_by
            )
            values ($1, $2, $3, $4, $5::jsonb, $6)
            returning *
          `,
          [
            input.workspaceId,
            input.connectionId,
            input.fileId,
            input.role ?? "attachment",
            JSON.stringify(input.metadata ?? {}),
            input.createdBy ?? null
          ]
        );

        await client.query("commit");

        const fileRow = fileResult.rows[0] as QueryResultRow;
        const connectionFileRow = connectionFileResult.rows[0] as QueryResultRow;
        return v2ConnectionAttachmentSchema.parse({
          id: String(connectionFileRow.id),
          connectionId: String(connectionFileRow.connection_id),
          fileId: String(connectionFileRow.file_id),
          role: String(connectionFileRow.role),
          metadata: asObject(connectionFileRow.metadata),
          filename: String(fileRow.filename),
          mimeType: fileRow.mime_type === null ? null : String(fileRow.mime_type),
          sizeBytes: fileRow.size_bytes === null ? null : Number(fileRow.size_bytes),
          sha256: fileRow.sha256 === null ? null : String(fileRow.sha256),
          processingStatus: fileRow.processing_status,
          createdAt: toIso(connectionFileRow.created_at)
        });
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },

    async getFileForDownload(fileId) {
      const result = await pool.query(
        `
          select
            id,
            workspace_id,
            storage_bucket,
            storage_path,
            filename,
            mime_type,
            size_bytes
          from files
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [fileId]
      );
      const row = result.rows[0];
      if (!row) return null;

      return {
        fileId: String(row.id),
        workspaceId: String(row.workspace_id),
        storageBucket: String(row.storage_bucket),
        storagePath: String(row.storage_path),
        filename: String(row.filename),
        mimeType: row.mime_type === null || row.mime_type === undefined ? null : String(row.mime_type),
        sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes)
      };
    },

    async detachCardAttachment(cardId, attachmentId) {
      const result = await pool.query(
        `
          update card_files
          set deleted_at = now()
          where id = $1
            and card_id = $2
            and deleted_at is null
        `,
        [attachmentId, cardId]
      );

      return (result.rowCount ?? 0) > 0;
    },

    async detachConnectionAttachment(connectionId, attachmentId) {
      const result = await pool.query(
        `
          update connection_files
          set deleted_at = now()
          where id = $1
            and connection_id = $2
            and deleted_at is null
        `,
        [attachmentId, connectionId]
      );

      return (result.rowCount ?? 0) > 0;
    }
  };
}
