/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚠️  DEPRECATION NOTICE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This adapter is a **temporary bridge** for migrating from v1 to v2 schema.
 *
 * AFTER MIGRATION (YADRAW_V2_STORAGE=v2-postgres):
 *   - This file is NOT used by production runtime.
 *   - Keep it for reference only.
 *   - Remove from index.ts after migration burn-in period.
 *
 * DO NOT use this adapter as production runtime after v2 migration.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Temporary legacy adapter: reads v1 database schema and maps to v2 DTOs.
 *
 * ⚠️ This is a **temporary bridge** for migration, not the v2 source of truth.
 * The canonical v2 repository lives in ./repository.ts and targets the v2 schema
 * described in packages/db/migrations/v2/001_core_foundation.sql.
 *
 * Key differences between v1 and v2 schemas handled here:
 *   boards.viewport (jsonb)           → viewport_x/y/zoom (numeric)
 *   cards.type_id                     → card_type_id
 *   cards.position (jsonb)            → position_x/y (numeric)
 *   cards.size (jsonb)                → width/height (numeric)
 *   connections.source_handle (text)  → source_port_key (text)
 *   connections.target_handle (text)  → target_port_key (text)
 *   connections.type_id (fk)          → type (text, resolved via connection_types.key)
 *   card_types.allowed_handles (jsonb)→ card_type_ports table (path: "direction" → array of ports)
 *   card_types (no default_width)     → default_width=300, default_height=180 fallback
 *   card_types (no deleted_at column) → queries omit deleted_at filter on card_types
 */

import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import {
  v2BoardDetailSchema,
  v2CardSchema,
  v2CardTypeSchema,
  v2ConnectionSchema,
  type V2CardTypePort,
  type V2ConnectionStatus,
  type V2JsonObject,
  type V2WorkspaceRole,
} from "@yadraw/shared";
import type { V2Repository } from "./repository.js";
import type { V2CreateCardRecordInput, V2CreateConnectionRecordInput } from "./repository.js";

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

function nowIso(): string {
  return new Date().toISOString();
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** v1 cards use position/size as jsonb — parse safely. */
function extractPosition(row: QueryResultRow): { x: number; y: number } {
  const pos = asObject(row.position);
  return { x: Number(pos.x ?? row.position_x ?? 0), y: Number(pos.y ?? row.position_y ?? 0) };
}

function extractSize(row: QueryResultRow): { width: number; height: number } {
  const sz = asObject(row.size);
  return {
    width: Number(sz.width ?? row.width ?? 300),
    height: Number(sz.height ?? row.height ?? 180),
  };
}

/** v1 boards use viewport as jsonb — parse safely. */
function extractViewport(row: QueryResultRow): { x: number; y: number; zoom: number } {
  const vp = asObject(row.viewport);
  return {
    x: Number(vp.x ?? row.viewport_x ?? 0),
    y: Number(vp.y ?? row.viewport_y ?? 0),
    zoom: Number(vp.zoom ?? row.viewport_zoom ?? 1),
  };
}

/** v1 connections store source/target handles. Map them to port keys. */
function extractSourcePortKey(row: QueryResultRow): string {
  return String(row.source_port_key ?? row.source_handle ?? "");
}

function extractTargetPortKey(row: QueryResultRow): string {
  return String(row.target_port_key ?? row.target_handle ?? "");
}

/** v1 card_types store port info in `allowed_handles` jsonb — convert to Port[] */
function portsFromAllowedHandles(
  cardTypeId: string,
  workspaceId: string,
  allowedHandles: unknown,
  timestamp: string
): V2CardTypePort[] {
  const handles = asObject(allowedHandles);
  const ports: V2CardTypePort[] = [];

  for (const [direction, entries] of Object.entries(handles)) {
    if (direction !== "input" && direction !== "output") continue;
    const list = Array.isArray(entries) ? entries : [];
    for (let i = 0; i < list.length; i++) {
      const entry = asObject(list[i]);
      ports.push({
        id: String(entry.id ?? randomUUID()),
        workspaceId,
        cardTypeId,
        key: String(entry.key ?? `port_${i}`),
        label: String(entry.label ?? entry.key ?? `Port ${i}`),
        direction: direction as "input" | "output",
        dataType: String(entry.dataType ?? "json"),
        required: Boolean(entry.required ?? true),
        sortOrder: Number(entry.sortOrder ?? i),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  return ports;
}

function legacyWorkspaceFromRow(row: QueryResultRow) {
  return {
    id: String(row.workspace_id ?? row.id),
    name: String(row.workspace_name ?? row.name ?? ""),
    slug: String(row.workspace_slug ?? row.slug ?? ""),
    createdAt: toIso(row.workspace_created_at ?? row.created_at),
    updatedAt: toIso(row.workspace_updated_at ?? row.updated_at),
  };
}

function legacyProjectFromRow(row: QueryResultRow) {
  return {
    id: String(row.project_id ?? row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.project_name ?? row.name ?? ""),
    createdAt: toIso(row.project_created_at ?? row.created_at),
    updatedAt: toIso(row.project_updated_at ?? row.updated_at),
  };
}

function legacyBoardFromRow(row: QueryResultRow) {
  const viewport = extractViewport(row);
  return {
    id: String(row.board_id ?? row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    name: String(row.board_name ?? row.name ?? ""),
    viewport,
    createdAt: toIso(row.board_created_at ?? row.created_at),
    updatedAt: toIso(row.board_updated_at ?? row.updated_at),
  };
}

/**
 * Parse a v1 card row into a v2 card DTO, preserving _yadraw metadata
 * separately for port recovery.
 *
 * Exported for testing.
 */
export function legacyCardFromRow(row: QueryResultRow) {
  const position = extractPosition(row);
  const size = extractSize(row);
  const rawData = asObject(row.data);
  // v1 stores internal yadraw metadata in data._yadraw — strip it for v2 validation
  const { _yadraw, ...cleanData } = rawData;
  return {
    card: v2CardSchema.parse({
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      boardId: String(row.board_id),
      cardTypeId: String(row.card_type_id ?? row.type_id ?? ""),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      data: cleanData as V2JsonObject,
      position,
      size,
      status: row.status ?? "draft",
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    }),
    _yadraw,
  };
}

function legacyConnectionFromRow(row: QueryResultRow) {
  const status: V2ConnectionStatus =
    row.status === "active" ? "active" : row.status === "disabled" ? "disabled" : "active";
  return v2ConnectionSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    boardId: String(row.board_id),
    sourceCardId: String(row.source_card_id),
    targetCardId: String(row.target_card_id),
    sourcePortKey: extractSourcePortKey(row),
    targetPortKey: extractTargetPortKey(row),
    type: String(row.type ?? "data"),
    label: String(row.label ?? ""),
    status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

function legacyCardTypeFromRow(row: QueryResultRow, ports: V2CardTypePort[] = []) {
  const defaultWidth = row.default_width ? Number(row.default_width) : 300;
  const defaultHeight = row.default_height ? Number(row.default_height) : 180;
  return v2CardTypeSchema.parse({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    key: String(row.key),
    name: String(row.name),
    description: String(row.description ?? ""),
    defaultData: asObject(row.default_data) as V2JsonObject,
    defaultSize: { width: defaultWidth, height: defaultHeight },
    ports,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

async function checkTableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(
    `select exists (
      select from information_schema.tables
      where table_schema = 'public' and table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Parse a single v1 port entry (string or object) into a V2CardTypePort.
 * Handles array-of-strings, array-of-objects, and object-map formats.
 *
 * Exported for testing.
 */
export function parsePortEntry(
  entry: unknown,
  direction: "input" | "output",
  cardTypeId: string,
  workspaceId: string,
  sortOrder: number,
  timestamp: string
): V2CardTypePort | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed || !/^[a-z][a-z0-9_]*$/.test(trimmed)) return null;
    return {
      id: randomUUID(),
      workspaceId,
      cardTypeId,
      key: trimmed,
      label: trimmed,
      direction,
      dataType: "json",
      required: direction === "input",
      sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  const obj = asObject(entry);
  const key = String(obj.key ?? obj.id ?? obj.name ?? "").trim();
  if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) return null;

  return {
    id: randomUUID(),
    workspaceId,
    cardTypeId,
    key,
    label: String(obj.label ?? obj.name ?? obj.title ?? key),
    direction,
    dataType: String(obj.dataType ?? obj.type ?? obj.schemaType ?? "json"),
    required: typeof obj.required === "boolean" ? obj.required : direction === "input",
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Parse cards.data._yadraw.inputs / .outputs into port entries.
 * Supports:
 *   - Array of strings: ["payload"] → port with key="payload"
 *   - Array of objects: [{key:"payload", label:"Payload"}] → full port
 *   - Object map: { "payload": {label:"Payload"} } → key from property name
 *   - Empty / missing / invalid → empty array
 *
 * Exported for testing.
 */
export function parseYadrawPorts(
  yadraw: unknown,
  cardTypeId: string,
  workspaceId: string,
  timestamp: string
): V2CardTypePort[] {
  const meta = asObject(yadraw);
  const inputs = meta.inputs;
  const outputs = meta.outputs;
  const ports: V2CardTypePort[] = [];
  let order = 0;

  for (const item of parsePortDirection(inputs, "input", cardTypeId, workspaceId, timestamp, order)) {
    ports.push(item);
    order++;
  }

  for (const item of parsePortDirection(outputs, "output", cardTypeId, workspaceId, timestamp, order)) {
    ports.push(item);
    order++;
  }

  return ports;
}

function parsePortDirection(
  value: unknown,
  direction: "input" | "output",
  cardTypeId: string,
  workspaceId: string,
  timestamp: string,
  startOrder: number
): V2CardTypePort[] {
  // Array of strings or objects
  if (Array.isArray(value)) {
    const result: V2CardTypePort[] = [];
    for (let i = 0; i < value.length; i++) {
      const port = parsePortEntry(value[i], direction, cardTypeId, workspaceId, startOrder + i, timestamp);
      if (port) result.push(port);
    }
    return result;
  }

  // Object map: { keyName: {label: ...}, keyName: "labelString" }
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return [];

  return Object.entries(obj)
    .map(([key, val], i) => {
      if (typeof val === "string") {
        return parsePortEntry({ key, label: val }, direction, cardTypeId, workspaceId, startOrder + i, timestamp);
      }
      return parsePortEntry({ key, ...asObject(val) }, direction, cardTypeId, workspaceId, startOrder + i, timestamp);
    })
    .filter((p): p is V2CardTypePort => p !== null);
}

/**
 * Aggregate ports from card-level _yadraw metadata, grouped by card_type_id.
 * Ports are deduplicated by direction+key within each card type.
 * Only cards with a valid type_id contribute.
 */
function aggregatePortsFromCardYadraw(
  cardRows: QueryResultRow[],
  workspaceId: string
): Map<string, V2CardTypePort[]> {
  const ts = nowIso();
  const result = new Map<string, V2CardTypePort[]>();

  for (const row of cardRows) {
    const cardTypeId = String(row.card_type_id ?? row.type_id ?? "").trim();
    if (!cardTypeId || cardTypeId === "null" || cardTypeId.length < 10) continue;

    const rawData = asObject(row.data);
    const yadraw = rawData._yadraw;
    const ports = parseYadrawPorts(yadraw, cardTypeId, workspaceId, ts);
    if (ports.length === 0) continue;

    // Merge with existing ports for this card type, dedup by direction+key
    const existing = result.get(cardTypeId) ?? [];
    const seen = new Set(existing.map((p) => `${p.direction}:${p.key}`));
    let lastOrder = existing.length > 0 ? Math.max(...existing.map((p) => p.sortOrder)) + 1 : 0;

    for (const port of ports) {
      const key = `${port.direction}:${port.key}`;
      if (!seen.has(key)) {
        seen.add(key);
        existing.push({ ...port, sortOrder: lastOrder++ });
      }
    }

    result.set(cardTypeId, existing);
  }

  return result;
}

/**
 * Merge card-level yadraw ports into card type ports.
 * Card-level ports only supplement existing ports when the card type
 * has no ports from allowed_handles (or v2 card_type_ports table).
 */
function mergeYadrawPortsIntoCardTypes(
  cardTypes: ReturnType<typeof legacyCardTypeFromRow>[],
  yadrawPorts: Map<string, V2CardTypePort[]>
): ReturnType<typeof legacyCardTypeFromRow>[] {
  if (yadrawPorts.size === 0) return cardTypes;

  return cardTypes.map((ct) => {
    const cardYadrawPorts = yadrawPorts.get(ct.id);
    if (!cardYadrawPorts || cardYadrawPorts.length === 0) return ct;

    // Only supplement if existing ports are empty
    if (ct.ports.length > 0) return ct;

    // Re-validate through schema so the output is always valid v2
    return legacyCardTypeFromRow(
      {
        id: ct.id,
        workspace_id: ct.workspaceId,
        key: ct.key,
        name: ct.name,
        description: ct.description,
        default_data: ct.defaultData,
        default_width: ct.defaultSize.width,
        default_height: ct.defaultSize.height,
        created_at: ct.createdAt,
        updated_at: ct.updatedAt,
      } as unknown as QueryResultRow,
      cardYadrawPorts
    );
  });
}

export function createV2LegacyPostgresRepository(databaseUrl: string): V2Repository {
  const pool = new Pool({ connectionString: databaseUrl });

  async function loadCardTypePorts(cardTypeIds: string[]): Promise<Map<string, V2CardTypePort[]>> {
    if (cardTypeIds.length === 0) return new Map();

    const hasPortsTable = await checkTableExists(pool, "card_type_ports");

    if (hasPortsTable) {
      // v2-style card_type_ports table exists
      const result = await pool.query(
        `select * from card_type_ports
         where card_type_id = any($1::uuid[])
           and deleted_at is null
         order by card_type_id asc, direction asc, sort_order asc, key asc`,
        [cardTypeIds]
      );
      const grouped = new Map<string, V2CardTypePort[]>();
      for (const row of result.rows) {
        const port: V2CardTypePort = {
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
          updatedAt: toIso(row.updated_at),
        };
        grouped.set(port.cardTypeId, [...(grouped.get(port.cardTypeId) ?? []), port]);
      }
      return grouped;
    }

    // v1-style: card_types has NO deleted_at column — omit the filter
    const ts = nowIso();
    const result = await pool.query(
      `select id, workspace_id, allowed_handles from card_types
       where id = any($1::uuid[])`,
      [cardTypeIds]
    );
    const grouped = new Map<string, V2CardTypePort[]>();
    for (const row of result.rows) {
      const ports = portsFromAllowedHandles(
        String(row.id),
        String(row.workspace_id),
        row.allowed_handles,
        ts
      );
      grouped.set(String(row.id), ports);
    }
    return grouped;
  }

  async function cardTypesFromRows(rows: QueryResultRow[]) {
    const ids = rows.map((r) => String(r.id));
    const groupedPorts = await loadCardTypePorts(ids);
    return rows.map((row) => legacyCardTypeFromRow(row, groupedPorts.get(String(row.id)) ?? []));
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
        `select wm.role
         from workspace_members wm
         join workspaces w on w.id = wm.workspace_id and w.deleted_at is null
         where wm.user_id = $1 and wm.workspace_id = $2
         limit 1`,
        [userId, workspaceId]
      );
      return roleFromRow(result.rows[0]);
    },

    async getBoardRole(userId, boardId) {
      const result = await pool.query(
        `select wm.role
         from boards b
         join workspace_members wm on wm.workspace_id = b.workspace_id
         where wm.user_id = $1 and b.id = $2 and b.deleted_at is null
         limit 1`,
        [userId, boardId]
      );
      return roleFromRow(result.rows[0]);
    },

    async getCardRole(userId, cardId) {
      const result = await pool.query(
        `select wm.role
         from cards c
         join workspace_members wm on wm.workspace_id = c.workspace_id
         where wm.user_id = $1 and c.id = $2 and c.deleted_at is null
         limit 1`,
        [userId, cardId]
      );
      return roleFromRow(result.rows[0]);
    },

    async getConnectionRole(userId, connectionId) {
      const result = await pool.query(
        `select wm.role
         from connections c
         join workspace_members wm on wm.workspace_id = c.workspace_id
         where wm.user_id = $1 and c.id = $2 and c.deleted_at is null
         limit 1`,
        [userId, connectionId]
      );
      return roleFromRow(result.rows[0]);
    },

    async getBoardDetail(boardId) {
      const boardResult = await pool.query(
        `select
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
           b.viewport,
           b.created_at as board_created_at,
           b.updated_at as board_updated_at
         from boards b
         join projects p on p.id = b.project_id and p.deleted_at is null
         join workspaces w on w.id = b.workspace_id and w.deleted_at is null
         where b.id = $1 and b.deleted_at is null
         limit 1`,
        [boardId]
      );
      const boardRow = boardResult.rows[0];
      if (!boardRow) return null;

      const cardsResult = await pool.query(
        `select * from cards where board_id = $1 and deleted_at is null
         order by created_at asc, id asc`,
        [boardId]
      );
      const rawCardRows = cardsResult.rows;
      const parsedCards = rawCardRows.map(legacyCardFromRow);
      const cards = parsedCards.map((pc) => pc.card);

      const workspaceId = String(boardRow.workspace_id);

      // Aggregate ports from card-level _yadraw metadata
      const cardYadrawPorts = aggregatePortsFromCardYadraw(
        rawCardRows,
        workspaceId
      );

      // v1 card_types has NO deleted_at column
      const cardTypesResult = await pool.query(
        `select * from card_types where workspace_id = $1
         order by name asc, id asc`,
        [workspaceId]
      );
      const cardTypes = await cardTypesFromRows(cardTypesResult.rows);
      const cardTypesWithPorts = mergeYadrawPortsIntoCardTypes(cardTypes, cardYadrawPorts);

      const connectionsResult = await pool.query(
        `select * from connections where board_id = $1 and deleted_at is null
         order by created_at asc, id asc`,
        [boardId]
      );
      const connections = connectionsResult.rows.map(legacyConnectionFromRow);

      return v2BoardDetailSchema.parse({
        workspace: legacyWorkspaceFromRow(boardRow),
        project: legacyProjectFromRow(boardRow),
        board: legacyBoardFromRow(boardRow),
        cardTypes: cardTypesWithPorts,
        cards,
        connections,
      });
    },

    async getBoard(boardId) {
      const result = await pool.query(
        `select * from boards where id = $1 and deleted_at is null limit 1`,
        [boardId]
      );
      const row = result.rows[0];
      return row ? legacyBoardFromRow(row) : null;
    },

    async listCardTypes(workspaceId) {
      // v1 card_types has NO deleted_at column
      const result = await pool.query(
        `select * from card_types where workspace_id = $1
         order by name asc, id asc`,
        [workspaceId]
      );
      return cardTypesFromRows(result.rows);
    },

    async getCardType(cardTypeId) {
      // v1 card_types has NO deleted_at column
      const result = await pool.query(
        `select * from card_types where id = $1 limit 1`,
        [cardTypeId]
      );
      const row = result.rows[0];
      if (!row) return null;
      const ports = await loadCardTypePorts([cardTypeId]);
      return legacyCardTypeFromRow(row, ports.get(cardTypeId) ?? []);
    },

    async getCard(cardId) {
      const result = await pool.query(
        `select * from cards where id = $1 and deleted_at is null limit 1`,
        [cardId]
      );
      const row = result.rows[0];
      return row ? legacyCardFromRow(row).card : null;
    },

    async createCard(input: V2CreateCardRecordInput) {
      const result = await pool.query(
        `insert into cards (
           workspace_id, board_id, type_id, title, description,
           data, position, size, status
         ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)
         returning *`,
        [
          input.workspaceId,
          input.boardId,
          input.cardTypeId,
          input.title,
          input.description,
          JSON.stringify(input.data),
          JSON.stringify(input.position),
          JSON.stringify(input.size),
          input.status,
        ]
      );
      return legacyCardFromRow(result.rows[0] as QueryResultRow).card;
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
        status: input.status ?? existing.status,
      };

      const result = await pool.query(
        `update cards
         set title = $2,
             description = $3,
             data = $4::jsonb,
             position = $5::jsonb,
             size = $6::jsonb,
             status = $7
         where id = $1 and deleted_at is null
         returning *`,
        [
          cardId,
          next.title,
          next.description,
          JSON.stringify(next.data),
          JSON.stringify(next.position),
          JSON.stringify(next.size),
          next.status,
        ]
      );
      const row = result.rows[0];
      return row ? legacyCardFromRow(row).card : null;
    },

    async deleteCard(cardId) {
      const result = await pool.query(
        `update cards set deleted_at = now() where id = $1 and deleted_at is null`,
        [cardId]
      );
      await pool.query(
        `update connections set deleted_at = now()
         where deleted_at is null and (source_card_id = $1 or target_card_id = $1)`,
        [cardId]
      );
      return (result.rowCount ?? 0) > 0;
    },

    async getConnection(connectionId) {
      const result = await pool.query(
        `select * from connections where id = $1 and deleted_at is null limit 1`,
        [connectionId]
      );
      const row = result.rows[0];
      return row ? legacyConnectionFromRow(row) : null;
    },

    async createConnection(input: V2CreateConnectionRecordInput) {
      const result = await pool.query(
        `insert into connections (
           workspace_id, board_id, source_card_id, target_card_id,
           source_handle, target_handle, label, status
         ) values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [
          input.workspaceId,
          input.boardId,
          input.sourceCardId,
          input.targetCardId,
          input.sourcePortKey,
          input.targetPortKey,
          input.label,
          input.status,
        ]
      );
      return legacyConnectionFromRow(result.rows[0] as QueryResultRow);
    },

    async deleteConnection(connectionId) {
      const result = await pool.query(
        `update connections set deleted_at = now()
         where id = $1 and deleted_at is null`,
        [connectionId]
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
