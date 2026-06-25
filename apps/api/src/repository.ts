import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import {
  boardSchema,
  demoBoard,
  type Board,
  type Card,
  type Connection,
  type CreateCardInput,
  type FileRef,
  type UpdateCardInput
} from "@yadraw/shared";

export type BoardRepository = {
  mode: "postgres" | "memory";
  getBoard(boardId: string): Promise<Board | null>;
  createCard(boardId: string, input: CreateCardInput): Promise<Card | null>;
  updateCard(cardId: string, input: UpdateCardInput): Promise<Card | null>;
  searchCards(query: string): Promise<Card[]>;
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

function dataWithCardMeta(card: Card): Record<string, unknown> {
  return {
    ...card.data,
    _yadraw: {
      typeKey: card.typeKey,
      inputs: card.inputs,
      outputs: card.outputs,
      tags: card.tags,
      files: card.files
    }
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
    data: input.data ?? existing.data,
    position: input.position ?? existing.position,
    size: input.size ?? existing.size,
    style: input.style ?? existing.style,
    inputs: input.inputs ?? existing.inputs,
    outputs: input.outputs ?? existing.outputs,
    files: input.files ?? existing.files,
    tags: input.tags ?? existing.tags
  };
}

export function createMemoryRepository(sourceBoard: Board = demoBoard): BoardRepository {
  const memoryBoard: Board = structuredClone(sourceBoard);

  return {
    mode: "memory",

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
        data: input.data ?? {},
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

    async searchCards(query) {
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

  return {
    mode: "postgres",

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
        data: input.data ?? {},
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
    },

    async searchCards(query) {
      const needle = query.trim();
      const result = await pool.query(
        `
          select c.*, ct.key as type_key
          from cards c
          left join card_types ct on ct.id = c.type_id
          where c.deleted_at is null
            and (
              $1 = ''
              or c.title ilike '%' || $1 || '%'
              or coalesce(c.description, '') ilike '%' || $1 || '%'
              or c.data::text ilike '%' || $1 || '%'
            )
          order by c.updated_at desc
          limit 50
        `,
        [needle]
      );

      return result.rows.map(cardFromRow);
    }
  };
}
