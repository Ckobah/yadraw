import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import {
  v2BoardDetailSchema,
  v2CardSchema,
  v2CardTypeSchema,
  v2ConnectionSchema,
  type V2Board,
  type V2BoardDetail,
  type V2Card,
  type V2CardStatus,
  type V2CardType,
  type V2CardTypePort,
  type V2Connection,
  type V2ConnectionStatus,
  type V2CreateConnectionInput,
  type V2JsonObject,
  type V2Project,
  type V2Size,
  type V2UpdateCardInput,
  type V2Viewport,
  type V2Workspace,
  type V2WorkspaceRole
} from "@yadraw/shared";

export type V2CreateCardRecordInput = {
  workspaceId: string;
  boardId: string;
  cardTypeId: string;
  title: string;
  description: string;
  data: V2JsonObject;
  position: { x: number; y: number };
  size: V2Size;
  status: V2CardStatus;
  visualStyle?: Record<string, unknown>;
};

export type V2CreateConnectionRecordInput = V2CreateConnectionInput & {
  workspaceId: string;
  boardId: string;
  status: V2ConnectionStatus;
};

export type V2Repository = {
  close?(): Promise<void>;
  getWorkspaceRole(userId: string, workspaceId: string): Promise<V2WorkspaceRole | null>;
  getBoardRole(userId: string, boardId: string): Promise<V2WorkspaceRole | null>;
  getCardRole(userId: string, cardId: string): Promise<V2WorkspaceRole | null>;
  getConnectionRole(userId: string, connectionId: string): Promise<V2WorkspaceRole | null>;
  getBoardDetail(boardId: string): Promise<V2BoardDetail | null>;
  getBoard(boardId: string): Promise<V2Board | null>;
  listCardTypes(workspaceId: string): Promise<V2CardType[]>;
  getCardType(cardTypeId: string): Promise<V2CardType | null>;
  getCard(cardId: string): Promise<V2Card | null>;
  createCard(input: V2CreateCardRecordInput): Promise<V2Card>;
  updateCard(cardId: string, input: V2UpdateCardInput): Promise<V2Card | null>;
  deleteCard(cardId: string): Promise<boolean>;
  getConnection(connectionId: string): Promise<V2Connection | null>;
  createConnection(input: V2CreateConnectionRecordInput): Promise<V2Connection>;
  deleteConnection(connectionId: string): Promise<boolean>;
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
  cards: V2Card[];
  connections: V2Connection[];
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
    createdAt: toIso(row.board_created_at ?? row.created_at),
    updatedAt: toIso(row.board_updated_at ?? row.updated_at)
  };
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
    defaultSize: {
      width: Number(row.default_width),
      height: Number(row.default_height)
    },
    ports,
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
    title: String(row.title),
    description: String(row.description ?? ""),
    data: asObject(row.data),
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
    updatedAt: toIso(row.updated_at)
  });
}

function connectionFromRow(row: QueryResultRow): V2Connection {
  return v2ConnectionSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    boardId: String(row.board_id),
    sourceCardId: String(row.source_card_id),
    targetCardId: String(row.target_card_id),
    sourcePortKey: String(row.source_port_key),
    targetPortKey: String(row.target_port_key),
    type: String(row.type),
    label: String(row.label ?? ""),
    status: row.status,
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
  const cardTypes: V2CardType[] = [
    {
      id: sourceTypeId,
      workspaceId: workspace.id,
      key: "source",
      name: "Source",
      description: "Provides input data.",
      defaultData: { kind: "source" },
      defaultSize: { width: 280, height: 160 },
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
      defaultSize: { width: 300, height: 180 },
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
      size: { width: 280, height: 160 },
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
      position: { x: 520, y: 160 },
      size: { width: 300, height: 180 },
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
      sourceCardId: cards[0]!.id,
      targetCardId: cards[1]!.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
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
    cards,
    connections
  };
}

export function createV2MemoryRepository(seed: V2MemorySeed = createDefaultV2MemorySeed()): V2Repository {
  const state = cloneJson(seed);
  const deletedCardIds = new Set<string>();
  const deletedConnectionIds = new Set<string>();

  function activeCards(): V2Card[] {
    return state.cards.filter((card) => !deletedCardIds.has(card.id));
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

  function roleForWorkspace(userId: string, workspaceId: string): V2WorkspaceRole | null {
    return (
      state.workspaceMembers.find(
        (member) => member.workspaceId === workspaceId && member.userId === userId
      )?.role ?? null
    );
  }

  return {
    async close() {},

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
        cardTypes: state.cardTypes,
        cards: activeCards(),
        connections: activeConnections()
      });
    },

    async getBoard(boardId) {
      return boardId === state.board.id ? cloneJson(state.board) : null;
    },

    async listCardTypes(workspaceId) {
      if (workspaceId !== state.workspace.id) return [];
      return cloneJson(state.cardTypes);
    },

    async getCardType(cardTypeId) {
      return cloneJson(state.cardTypes.find((cardType) => cardType.id === cardTypeId) ?? null);
    },

    async getCard(cardId) {
      if (deletedCardIds.has(cardId)) return null;
      return cloneJson(state.cards.find((card) => card.id === cardId) ?? null);
    },

    async createCard(input) {
      const timestamp = nowIso();
      const card = v2CardSchema.parse({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        cardTypeId: input.cardTypeId,
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
      return cloneJson(card);
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
      return cloneJson(updated);
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
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        sourcePortKey: input.sourcePortKey,
        targetPortKey: input.targetPortKey,
        type: input.type,
        label: input.label,
        status: input.status,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      state.connections.push(connection);
      return cloneJson(connection);
    },

    async deleteConnection(connectionId) {
      const exists = state.connections.some(
        (connection) => connection.id === connectionId && !deletedConnectionIds.has(connection.id)
      );
      if (!exists) return false;

      deletedConnectionIds.add(connectionId);
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

  function roleFromRow(row: QueryResultRow | undefined): V2WorkspaceRole | null {
    return row?.role ? (String(row.role) as V2WorkspaceRole) : null;
  }

  return {
    async close() {
      await pool.end();
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
          select *
          from cards
          where board_id = $1
            and deleted_at is null
          order by created_at asc, id asc
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
        cards,
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

    async getCard(cardId) {
      const result = await pool.query(
        `
          select *
          from cards
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [cardId]
      );
      const row = result.rows[0];
      return row ? cardFromRow(row) : null;
    },

    async createCard(input) {
      const result = await pool.query(
        `
          insert into cards (
            workspace_id,
            board_id,
            card_type_id,
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
          values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12)
          returning *
        `,
        [
          input.workspaceId,
          input.boardId,
          input.cardTypeId,
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

      return cardFromRow(result.rows[0] as QueryResultRow);
    },

    async updateCard(cardId, input) {
      const existing = await this.getCard(cardId);
      if (!existing) return null;

      const next = {
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        data: input.data ?? existing.data,
        position: input.position ?? existing.position,
        size: input.size ?? existing.size,
        visualStyle: input.visualStyle ?? existing.visualStyle,
        status: input.status ?? existing.status
      };

      const result = await pool.query(
        `
          update cards
          set title = $2,
              description = $3,
              data = $4::jsonb,
              position_x = $5,
              position_y = $6,
              width = $7,
              height = $8,
              visual_style = $9::jsonb,
              status = $10
          where id = $1
            and deleted_at is null
          returning *
        `,
        [
          cardId,
          next.title,
          next.description,
          JSON.stringify(next.data),
          next.position.x,
          next.position.y,
          next.size.width,
          next.size.height,
          JSON.stringify(next.visualStyle),
          next.status
        ]
      );

      const row = result.rows[0];
      return row ? cardFromRow(row) : null;
    },

    async deleteCard(cardId) {
      const result = await pool.query(
        `
          update cards
          set deleted_at = now()
          where id = $1
            and deleted_at is null
        `,
        [cardId]
      );

      await pool.query(
        `
          update connections
          set deleted_at = now()
          where deleted_at is null
            and (source_card_id = $1 or target_card_id = $1)
        `,
        [cardId]
      );

      return (result.rowCount ?? 0) > 0;
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
            source_card_id,
            target_card_id,
            source_port_key,
            target_port_key,
            type,
            label,
            status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          returning *
        `,
        [
          input.workspaceId,
          input.boardId,
          input.sourceCardId,
          input.targetCardId,
          input.sourcePortKey,
          input.targetPortKey,
          input.type,
          input.label,
          input.status
        ]
      );

      return connectionFromRow(result.rows[0] as QueryResultRow);
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
    }
  };
}
