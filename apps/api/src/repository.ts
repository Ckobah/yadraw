import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import {
  boardSchema,
  cardMetadataSchema,
  cardTemplates,
  demoBoard,
  demoIds,
  demoNotifications,
  demoWorkspaceMembers,
  type Board,
  type Card,
  type CardTemplate,
  type Connection,
  type CreateCardInput,
  type FileRef,
  getCardTemplate,
  type Notification,
  type UpdateCardInput,
  type WorkspaceRole,
  type WorkspaceMember
} from "@yadraw/shared";

export type BoardFile = FileRef & {
  cardId: string;
  cardTitle: string;
  cardTypeKey: string;
  cardStatus: Card["status"];
};

export type AttachFileInput = {
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  role: string;
};

export type BoardRepository = {
  mode: "postgres" | "memory";
  close?(): Promise<void>;
  getBoardRole(userId: string, boardId: string): Promise<WorkspaceRole | null>;
  getCardRole(userId: string, cardId: string): Promise<WorkspaceRole | null>;
  getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null>;
  getBoard(boardId: string): Promise<Board | null>;
  createCard(boardId: string, input: CreateCardInput): Promise<Card | null>;
  updateCard(cardId: string, input: UpdateCardInput): Promise<Card | null>;
  deleteCard(cardId: string): Promise<Card | null>;
  restoreCard(cardId: string): Promise<Card | null>;
  listDeletedCards(boardId: string): Promise<Card[]>;
  listCardTemplates(boardId: string): Promise<CardTemplate[]>;
  listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[] | null>;
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(notificationId: string, userId: string): Promise<Notification | null>;
  listFiles(boardId: string): Promise<BoardFile[]>;
  attachFile(cardId: string, input: AttachFileInput): Promise<Card | null>;
  searchCards(query: string, boardId?: string): Promise<Card[]>;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asFiles(value: unknown): FileRef[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : randomUUID(),
      filename: typeof item.filename === "string" ? item.filename : "untitled",
      mimeType: typeof item.mimeType === "string" ? item.mimeType : undefined,
      sizeBytes: typeof item.sizeBytes === "number" ? item.sizeBytes : undefined,
      role: typeof item.role === "string" ? item.role : "attachment"
    }));
}

function stripInternalData(data: Record<string, unknown>): Record<string, unknown> {
  const publicData = { ...data };
  delete publicData._yadraw;
  return publicData;
}

function sanitizeUserData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  return data ? stripInternalData(data) : {};
}

function dataWithCardMeta(card: Card): Record<string, unknown> {
  return {
    ...sanitizeUserData(card.data),
    _yadraw: cardMetadataSchema.parse({
      typeKey: card.typeKey,
      inputs: card.inputs,
      outputs: card.outputs,
      tags: card.tags,
      files: card.files
    })
  };
}

function cardFromRow(row: QueryResultRow): Card {
  const rawData = asObject(row.data);
  const meta = asObject(rawData._yadraw);

  return {
    id: String(row.id),
    boardId: String(row.board_id),
    typeKey: typeof meta.typeKey === "string" ? meta.typeKey : String(row.type_key ?? "note"),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : undefined,
    status: row.status ?? "draft",
    data: stripInternalData(rawData),
    position: {
      x: Number(asObject(row.position).x ?? 0),
      y: Number(asObject(row.position).y ?? 0)
    },
    size: {
      width: Number(asObject(row.size).width ?? 320),
      height: Number(asObject(row.size).height ?? 180)
    },
    style: asObject(row.style),
    inputs: asStringArray(meta.inputs),
    outputs: asStringArray(meta.outputs),
    files: asFiles(meta.files),
    tags: asStringArray(meta.tags)
  };
}

function connectionFromRow(row: QueryResultRow): Connection {
  return {
    id: String(row.id),
    boardId: String(row.board_id),
    sourceCardId: String(row.source_card_id),
    targetCardId: String(row.target_card_id),
    sourceHandle: row.source_handle ? String(row.source_handle) : undefined,
    targetHandle: row.target_handle ? String(row.target_handle) : undefined,
    label: row.label ? String(row.label) : undefined,
    status: row.status ?? "draft",
    contract: asObject(row.contract),
    mapping: asObject(row.mapping),
    condition: asObject(row.condition),
    style: asObject(row.style)
  };
}

function applyCardInput(existing: Card, input: UpdateCardInput): Card {
  return {
    ...existing,
    description: input.description ?? existing.description,
    typeKey: input.typeKey ?? existing.typeKey,
    title: input.title ?? existing.title,
    status: input.status ?? existing.status,
    data: input.data ? sanitizeUserData(input.data) : existing.data,
    position: input.position ?? existing.position,
    size: input.size ?? existing.size,
    style: input.style ?? existing.style,
    inputs: input.inputs ?? existing.inputs,
    outputs: input.outputs ?? existing.outputs,
    files: input.files ?? existing.files,
    tags: input.tags ?? existing.tags
  };
}

function normalizeFileName(filename: string): string {
  return filename
    .split(/[/\\]/)
    .at(-1)
    ?.replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 160) ?? "attachment";
}

function buildFileRef(input: AttachFileInput): FileRef {
  const filename = normalizeFileName(input.filename);

  return {
    id: randomUUID(),
    filename: filename || "attachment",
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    role: input.role
  };
}

function templateFromCardTypeRow(row: QueryResultRow): CardTemplate {
  const key = String(row.key);
  const fallback = getCardTemplate(key);
  const defaultData = asObject(row.default_data);
  const color = row.color ? String(row.color) : fallback?.color ?? "blue";

  return {
    key,
    name: String(row.name ?? fallback?.name ?? key),
    description: row.description ? String(row.description) : fallback?.description ?? "",
    icon: row.icon ? String(row.icon) : fallback?.icon ?? "file-text",
    color,
    defaults: {
      ...(fallback?.defaults ?? {
        typeKey: key,
        title: `New ${String(row.name ?? key)}`,
        description: row.description ? String(row.description) : undefined,
        status: "draft",
        data: {},
        size: { width: 300, height: 175 },
        style: { accent: color },
        inputs: ["input"],
        outputs: ["output"],
        tags: [key]
      }),
      typeKey: key,
      data: Object.keys(defaultData).length > 0 ? defaultData : fallback?.defaults.data ?? {},
      style: {
        ...(fallback?.defaults.style ?? {}),
        accent: color
      }
    }
  };
}

function memberFromRow(row: QueryResultRow): WorkspaceMember {
  const userId = String(row.user_id);
  const fallback = demoWorkspaceMembers.find((member) => member.userId === userId);

  return {
    id: String(row.id),
    userId,
    workspaceId: String(row.workspace_id),
    name: fallback?.name ?? `Workspace member ${userId.slice(0, 8)}`,
    email: fallback?.email ?? `${userId.slice(0, 8)}@workspace.local`,
    role: row.role,
    status: "active"
  };
}

function notificationFromRow(row: QueryResultRow): Notification {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    type: String(row.type),
    title: String(row.title),
    body: row.body ? String(row.body) : undefined,
    objectType: row.object_type ? String(row.object_type) : undefined,
    objectId: row.object_id ? String(row.object_id) : undefined,
    metadata: asObject(row.metadata),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : undefined,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function boardFilesFromCards(cards: Card[]): BoardFile[] {
  return cards.flatMap((card) =>
    card.files.map((file) => ({
      ...file,
      cardId: card.id,
      cardTitle: card.title,
      cardTypeKey: card.typeKey,
      cardStatus: card.status
    }))
  );
}

export function createMemoryRepository(sourceBoard: Board = demoBoard): BoardRepository {
  const memoryBoard: Board = structuredClone(sourceBoard);
  const notifications: Notification[] = structuredClone(demoNotifications);
  const deletedCards: Card[] = [];

  function getMemoryWorkspaceRole(userId: string, workspaceId: string): WorkspaceRole | null {
    if (workspaceId !== memoryBoard.workspaceId) return null;
    return demoWorkspaceMembers.find((member) => member.userId === userId)?.role ?? null;
  }

  return {
    mode: "memory",

    async getBoardRole(userId, boardId) {
      if (boardId !== memoryBoard.id) return null;
      return getMemoryWorkspaceRole(userId, memoryBoard.workspaceId);
    },

    async getCardRole(userId, cardId) {
      const card = [...memoryBoard.cards, ...deletedCards].find((item) => item.id === cardId);
      if (!card) return null;
      return getMemoryWorkspaceRole(userId, memoryBoard.workspaceId);
    },

    async getWorkspaceRole(userId, workspaceId) {
      return getMemoryWorkspaceRole(userId, workspaceId);
    },

    async getBoard(boardId) {
      if (boardId !== memoryBoard.id) return null;
      return boardSchema.parse(memoryBoard);
    },

    async createCard(boardId, input) {
      if (boardId !== memoryBoard.id) return null;

      const card: Card = {
        id: randomUUID(),
        boardId,
        typeKey: input.typeKey ?? "note",
        title: input.title ?? "Untitled card",
        description: input.description,
        status: input.status ?? "draft",
        data: sanitizeUserData(input.data),
        position: input.position ?? { x: 180, y: 160 },
        size: input.size ?? { width: 300, height: 175 },
        style: input.style ?? { accent: "blue" },
        inputs: input.inputs ?? ["input"],
        outputs: input.outputs ?? ["output"],
        files: input.files ?? [],
        tags: input.tags ?? []
      };

      memoryBoard.cards.push(card);
      return card;
    },

    async updateCard(cardId, input) {
      const index = memoryBoard.cards.findIndex((card) => card.id === cardId);
      const existingCard = memoryBoard.cards[index];
      if (index === -1 || !existingCard) return null;

      memoryBoard.cards[index] = applyCardInput(existingCard, input);
      return memoryBoard.cards[index];
    },

    async deleteCard(cardId) {
      const index = memoryBoard.cards.findIndex((card) => card.id === cardId);
      const existingCard = memoryBoard.cards[index];
      if (index === -1 || !existingCard) return null;

      memoryBoard.cards.splice(index, 1);
      deletedCards.unshift(existingCard);
      return existingCard;
    },

    async restoreCard(cardId) {
      const index = deletedCards.findIndex((card) => card.id === cardId);
      const deletedCard = deletedCards[index];
      if (index === -1 || !deletedCard) return null;

      deletedCards.splice(index, 1);
      const restoredCard: Card = { ...deletedCard };
      memoryBoard.cards.push(restoredCard);
      return restoredCard;
    },

    async listDeletedCards(boardId) {
      if (boardId !== memoryBoard.id) return [];
      return deletedCards;
    },

    async listCardTemplates(boardId) {
      if (boardId !== memoryBoard.id) return [];
      return cardTemplates;
    },

    async listWorkspaceMembers(workspaceId) {
      if (workspaceId !== memoryBoard.workspaceId) return null;
      return demoWorkspaceMembers;
    },

    async listNotifications(userId) {
      return notifications
        .filter((notification) => notification.userId === userId)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    },

    async markNotificationRead(notificationId, userId) {
      const index = notifications.findIndex(
        (notification) => notification.id === notificationId && notification.userId === userId
      );
      const notification = notifications[index];
      if (index === -1 || !notification) return null;

      const readAt = notification.readAt ?? new Date().toISOString();
      notifications[index] = {
        ...notification,
        readAt
      };

      return notifications[index];
    },

    async listFiles(boardId) {
      if (boardId !== memoryBoard.id) return [];
      return boardFilesFromCards(memoryBoard.cards);
    },

    async attachFile(cardId, input) {
      const index = memoryBoard.cards.findIndex((card) => card.id === cardId);
      const existingCard = memoryBoard.cards[index];
      if (index === -1 || !existingCard) return null;

      const nextFile = buildFileRef(input);
      memoryBoard.cards[index] = applyCardInput(existingCard, {
        files: [...existingCard.files, nextFile]
      });

      return memoryBoard.cards[index];
    },

    async searchCards(query, boardId) {
      if (boardId && boardId !== memoryBoard.id) return [];

      const needle = query.trim().toLowerCase();
      if (!needle) return memoryBoard.cards;

      return memoryBoard.cards.filter((card) => {
        const haystack = [
          card.title,
          card.description,
          card.typeKey,
          card.tags.join(" "),
          JSON.stringify(card.data)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(needle);
      });
    }
  };
}

export async function createPostgresRepository(databaseUrl: string): Promise<BoardRepository> {
  const pool = new Pool({
    connectionString: databaseUrl
  });

  await pool.query("select 1");

  async function getCardTypeId(workspaceId: string, typeKey: string): Promise<string | null> {
    const result = await pool.query<{ id: string }>(
      `
        select id
        from card_types
        where workspace_id = $1
          and key = $2
        order by version desc
        limit 1
      `,
      [workspaceId, typeKey]
    );

    return result.rows[0]?.id ?? null;
  }

  async function getCard(cardId: string): Promise<Card | null> {
    const result = await pool.query(
      `
        select c.*, ct.key as type_key
        from cards c
        left join card_types ct on ct.id = c.type_id
        where c.id = $1
          and c.deleted_at is null
        limit 1
      `,
      [cardId]
    );

    const row = result.rows[0];
    return row ? cardFromRow(row) : null;
  }

  async function getDeletedCard(cardId: string): Promise<Card | null> {
    const result = await pool.query(
      `
        select c.*, ct.key as type_key
        from cards c
        left join card_types ct on ct.id = c.type_id
        where c.id = $1
          and c.deleted_at is not null
        limit 1
      `,
      [cardId]
    );

    const row = result.rows[0];
    return row ? cardFromRow(row) : null;
  }

  async function updateCardRecord(cardId: string, input: UpdateCardInput): Promise<Card | null> {
    const existingCard = await getCard(cardId);
    if (!existingCard) return null;

    const nextCard = applyCardInput(existingCard, input);
    const boardResult = await pool.query<{ workspace_id: string }>(
      "select workspace_id from boards where id = $1 and deleted_at is null limit 1",
      [nextCard.boardId]
    );
    const workspaceId = boardResult.rows[0]?.workspace_id;
    if (!workspaceId) return null;

    const typeId = await getCardTypeId(workspaceId, nextCard.typeKey);
    const result = await pool.query(
      `
        update cards
        set type_id = $2,
            title = $3,
            description = $4,
            status = $5,
            data = $6::jsonb,
            position = $7::jsonb,
            size = $8::jsonb,
            style = $9::jsonb
        where id = $1
          and deleted_at is null
        returning *
      `,
      [
        cardId,
        typeId,
        nextCard.title,
        nextCard.description ?? null,
        nextCard.status,
        JSON.stringify(dataWithCardMeta(nextCard)),
        JSON.stringify(nextCard.position),
        JSON.stringify(nextCard.size),
        JSON.stringify(nextCard.style)
      ]
    );

    const row = result.rows[0];
    return row ? cardFromRow({ ...row, type_key: nextCard.typeKey }) : null;
  }

  async function getWorkspaceRoleForUser(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceRole | null> {
    const result = await pool.query<{ role: WorkspaceRole }>(
      `
        select wm.role
        from workspace_members wm
        join workspaces w on w.id = wm.workspace_id
        where wm.user_id = $1
          and wm.workspace_id = $2
          and w.deleted_at is null
        limit 1
      `,
      [userId, workspaceId]
    );

    return result.rows[0]?.role ?? null;
  }

  return {
    mode: "postgres",

    async close() {
      await pool.end();
    },

    async getBoardRole(userId, boardId) {
      const result = await pool.query<{ role: WorkspaceRole }>(
        `
          select wm.role
          from boards b
          join workspace_members wm on wm.workspace_id = b.workspace_id
          where b.id = $1
            and b.deleted_at is null
            and wm.user_id = $2
          limit 1
        `,
        [boardId, userId]
      );

      return result.rows[0]?.role ?? null;
    },

    async getCardRole(userId, cardId) {
      const result = await pool.query<{ role: WorkspaceRole }>(
        `
          select wm.role
          from cards c
          join workspace_members wm on wm.workspace_id = c.workspace_id
          where c.id = $1
            and wm.user_id = $2
          limit 1
        `,
        [cardId, userId]
      );

      return result.rows[0]?.role ?? null;
    },

    async getWorkspaceRole(userId, workspaceId) {
      return getWorkspaceRoleForUser(userId, workspaceId);
    },

    async getBoard(boardId) {
      const boardResult = await pool.query(
        `
          select *
          from boards
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [boardId]
      );
      const boardRow = boardResult.rows[0];
      if (!boardRow) return null;

      const cardsResult = await pool.query(
        `
          select c.*, ct.key as type_key
          from cards c
          left join card_types ct on ct.id = c.type_id
          where c.board_id = $1
            and c.deleted_at is null
          order by c.created_at asc, c.title asc
        `,
        [boardId]
      );

      const connectionsResult = await pool.query(
        `
          select *
          from connections
          where board_id = $1
            and deleted_at is null
          order by created_at asc
        `,
        [boardId]
      );

      return boardSchema.parse({
        id: String(boardRow.id),
        workspaceId: String(boardRow.workspace_id),
        projectId: String(boardRow.project_id),
        name: String(boardRow.name),
        description: boardRow.description ? String(boardRow.description) : undefined,
        viewport: asObject(boardRow.viewport),
        settings: asObject(boardRow.settings),
        cards: cardsResult.rows.map(cardFromRow),
        connections: connectionsResult.rows.map(connectionFromRow)
      });
    },

    async createCard(boardId, input) {
      const boardResult = await pool.query<{ workspace_id: string }>(
        "select workspace_id from boards where id = $1 and deleted_at is null limit 1",
        [boardId]
      );
      const workspaceId = boardResult.rows[0]?.workspace_id;
      if (!workspaceId) return null;

      const card: Card = {
        id: randomUUID(),
        boardId,
        typeKey: input.typeKey ?? "note",
        title: input.title ?? "Untitled card",
        description: input.description,
        status: input.status ?? "draft",
        data: sanitizeUserData(input.data),
        position: input.position ?? { x: 180, y: 160 },
        size: input.size ?? { width: 300, height: 175 },
        style: input.style ?? { accent: "blue" },
        inputs: input.inputs ?? ["input"],
        outputs: input.outputs ?? ["output"],
        files: input.files ?? [],
        tags: input.tags ?? []
      };
      const typeId = await getCardTypeId(workspaceId, card.typeKey);

      const result = await pool.query(
        `
          insert into cards (
            id, workspace_id, board_id, type_id, title, description,
            status, data, position, size, style
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
          returning *
        `,
        [
          card.id,
          workspaceId,
          boardId,
          typeId,
          card.title,
          card.description ?? null,
          card.status,
          JSON.stringify(dataWithCardMeta(card)),
          JSON.stringify(card.position),
          JSON.stringify(card.size),
          JSON.stringify(card.style)
        ]
      );

      return cardFromRow({ ...result.rows[0], type_key: card.typeKey });
    },

    async updateCard(cardId, input) {
      return updateCardRecord(cardId, input);
    },

    async deleteCard(cardId) {
      const existingCard = await getCard(cardId);
      if (!existingCard) return null;

      await pool.query(
        `
          update cards
          set deleted_at = now()
          where id = $1
            and deleted_at is null
        `,
        [cardId]
      );

      return existingCard;
    },

    async restoreCard(cardId) {
      const deletedCard = await getDeletedCard(cardId);
      if (!deletedCard) return null;

      const result = await pool.query(
        `
          update cards
          set deleted_at = null
          where id = $1
          returning *
        `,
        [cardId]
      );

      const row = result.rows[0];
      return row ? cardFromRow({ ...row, type_key: deletedCard.typeKey }) : null;
    },

    async listDeletedCards(boardId) {
      const result = await pool.query(
        `
          select c.*, ct.key as type_key
          from cards c
          left join card_types ct on ct.id = c.type_id
          where c.board_id = $1
            and c.deleted_at is not null
          order by c.deleted_at desc, c.updated_at desc
        `,
        [boardId]
      );

      return result.rows.map(cardFromRow);
    },

    async listCardTemplates(boardId) {
      const result = await pool.query(
        `
          select ct.*
          from boards b
          join card_types ct on ct.workspace_id = b.workspace_id
          where b.id = $1
            and b.deleted_at is null
          order by ct.is_system desc, ct.name asc
        `,
        [boardId]
      );

      return result.rows.map(templateFromCardTypeRow);
    },

    async listWorkspaceMembers(workspaceId) {
      const workspaceResult = await pool.query(
        `
          select id
          from workspaces
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [workspaceId]
      );
      if (!workspaceResult.rows[0]) return null;

      const result = await pool.query(
        `
          select *
          from workspace_members
          where workspace_id = $1
          order by
            case role
              when 'owner' then 1
              when 'admin' then 2
              when 'editor' then 3
              when 'viewer' then 4
              else 5
            end,
            created_at asc
        `,
        [workspaceId]
      );

      if (result.rows.length > 0) {
        return result.rows.map(memberFromRow);
      }

      return workspaceId === demoIds.workspace ? demoWorkspaceMembers : [];
    },

    async listNotifications(userId) {
      const result = await pool.query(
        `
          select *
          from notifications
          where user_id = $1
          order by created_at desc
          limit 30
        `,
        [userId]
      );

      return result.rows.map(notificationFromRow);
    },

    async markNotificationRead(notificationId, userId) {
      const result = await pool.query(
        `
          update notifications
          set read_at = coalesce(read_at, now())
          where id = $1
            and user_id = $2
          returning *
        `,
        [notificationId, userId]
      );

      const row = result.rows[0];
      return row ? notificationFromRow(row) : null;
    },

    async listFiles(boardId) {
      const result = await pool.query(
        `
          select c.*, ct.key as type_key
          from cards c
          left join card_types ct on ct.id = c.type_id
          where c.board_id = $1
            and c.deleted_at is null
          order by c.created_at asc, c.title asc
        `,
        [boardId]
      );

      return boardFilesFromCards(result.rows.map(cardFromRow));
    },

    async attachFile(cardId, input) {
      const existingCard = await getCard(cardId);
      if (!existingCard) return null;

      const nextFile = buildFileRef(input);
      return updateCardRecord(cardId, {
        files: [...existingCard.files, nextFile]
      });
    },

    async searchCards(query, boardId) {
      const needle = query.trim();
      const result = await pool.query(
        `
          select c.*, ct.key as type_key
          from cards c
          left join card_types ct on ct.id = c.type_id
          where c.deleted_at is null
            and ($2::uuid is null or c.board_id = $2::uuid)
            and (
              $1 = ''
              or c.title ilike '%' || $1 || '%'
              or coalesce(c.description, '') ilike '%' || $1 || '%'
              or c.data::text ilike '%' || $1 || '%'
            )
          order by c.updated_at desc
          limit 50
        `,
        [needle, boardId ?? null]
      );

      return result.rows.map(cardFromRow);
    }
  };
}
