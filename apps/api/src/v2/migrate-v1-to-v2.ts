#!/usr/bin/env tsx
/**
 * v1 → v2 Migration Script
 *
 * Reads from DATABASE_URL (v1 schema) and writes to V2_DATABASE_URL (v2 schema).
 *
 * Usage:
 *   V2_DATABASE_URL=postgres://... DATABASE_URL=postgres://... npx tsx src/v2/migrate-v1-to-v2.ts
 *
 * Migration steps:
 *   1. Apply v2 schema (create tables, enums, triggers via 001_core_foundation.sql)
 *   2. Migrate workspaces (no owner_id/settings/metadata in v2)
 *   3. Migrate projects (no description/settings/metadata in v2)
 *   4. Migrate boards (viewport JSONB → viewport_x/y/zoom columns)
 *   5. Migrate card_types (add default_width=300, default_height=180)
 *   6. Migrate card_type_ports (from allowed_handles + _yadraw aggregation)
 *   7. Migrate cards (type_id→card_type_id, position/size JSONB→columns, strip _yadraw)
 *   8. Migrate connections (source_handle→source_port_key, type_id→type name)
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";

config({ path: new URL("../../../../../.env", import.meta.url) });
config();

const { Pool } = pg;

interface MigrationReport {
  workspaces: { v1: number; v2: number; errors: string[] };
  projects: { v1: number; v2: number; errors: string[] };
  boards: { v1: number; v2: number; errors: string[] };
  cardTypes: { v1: number; v2: number; errors: string[] };
  cardTypePorts: { v1: number; v2: number; errors: string[] };
  cards: { v1: number; v2: number; errors: string[] };
  connections: { v1: number; v2: number; errors: string[] };
  warnings: string[];
}

function createEmptyReport(): MigrationReport {
  return {
    workspaces: { v1: 0, v2: 0, errors: [] },
    projects: { v1: 0, v2: 0, errors: [] },
    boards: { v1: 0, v2: 0, errors: [] },
    cardTypes: { v1: 0, v2: 0, errors: [] },
    cardTypePorts: { v1: 0, v2: 0, errors: [] },
    cards: { v1: 0, v2: 0, errors: [] },
    connections: { v1: 0, v2: 0, errors: [] },
    warnings: [],
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
}

function safeString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return isNaN(n) ? fallback : n;
}

function toTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number")
    return new Date(value);
  return new Date();
}

/* ------------------------------------------------------------------ */
/*  Port Helpers (mirrors repository.legacy-postgres.ts)               */
/* ------------------------------------------------------------------ */

interface PortDef {
  key: string;
  label: string;
  direction: "input" | "output";
  dataType: string;
  required: boolean;
}

function parsePortEntry(
  entry: unknown,
  direction: "input" | "output",
): PortDef | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed || !/^[a-z][a-z0-9_]*$/.test(trimmed)) return null;
    return {
      key: trimmed,
      label: trimmed,
      direction,
      dataType: "json",
      required: direction === "input",
    };
  }

  const obj = asObject(entry);
  const key = safeString(obj.key || obj.id || obj.name).trim();
  if (!key || !/^[a-z][a-z0-9_]*$/.test(key)) return null;

  return {
    key,
    label: safeString(obj.label || obj.name || obj.title || key),
    direction,
    dataType: safeString(obj.dataType || obj.type || obj.schemaType, "json"),
    required:
      typeof obj.required === "boolean"
        ? obj.required
        : direction === "input",
  };
}

function parsePortDirection(
  value: unknown,
  direction: "input" | "output",
): PortDef[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parsePortEntry(item, direction))
      .filter((p): p is PortDef => p !== null);
  }
  const obj = asObject(value);
  if (Object.keys(obj).length === 0) return [];
  return Object.entries(obj)
    .map(([key, val]) => {
      if (typeof val === "string") {
        return parsePortEntry({ key, label: val }, direction);
      }
      return parsePortEntry({ key, ...asObject(val) }, direction);
    })
    .filter((p): p is PortDef => p !== null);
}

function parseYadrawPortDefs(yadraw: unknown): PortDef[] {
  const meta = asObject(yadraw);
  const inputs = meta.inputs;
  const outputs = meta.outputs;
  return [
    ...parsePortDirection(inputs, "input"),
    ...parsePortDirection(outputs, "output"),
  ];
}

function portsFromAllowedHandles(allowedHandles: unknown): PortDef[] {
  const handles = asObject(allowedHandles);
  const ports: PortDef[] = [];
  for (const [direction, entries] of Object.entries(handles)) {
    if (direction !== "input" && direction !== "output") continue;
    const list = Array.isArray(entries) ? entries : [];
    for (const item of list) {
      const p = parsePortEntry(item, direction as "input" | "output");
      if (p) ports.push(p);
    }
  }
  return ports;
}

/* ------------------------------------------------------------------ */
/*  Main Migration Logic                                               */
/* ------------------------------------------------------------------ */

async function runMigration(): Promise<MigrationReport> {
  const v1Url = process.env.DATABASE_URL;
  const v2Url = process.env.V2_DATABASE_URL;

  if (!v1Url) throw new Error("DATABASE_URL (v1) is required");
  if (!v2Url) throw new Error("V2_DATABASE_URL (v2) is required");

  console.log("── V1 → V2 Migration ──");
  console.log("  V1 (source):", v1Url.replace(/\/\/.*@/, "//*****@"));
  console.log("  V2 (target):", v2Url.replace(/\/\/.*@/, "//*****@"));
  console.log();

  const v1 = new Pool({ connectionString: v1Url });
  const v2 = new Pool({ connectionString: v2Url });
  const report = createEmptyReport();

  // Check if v2 is already populated
  const existingCheck = await v2.query(
    `select exists (select from information_schema.tables where table_schema='public' and table_name='workspaces') as has_workspaces`,
  );
  const v2AlreadyPopulated = existingCheck.rows[0]?.has_workspaces === true;

  if (v2AlreadyPopulated) {
    const count = await v2.query("select count(*) from workspaces where deleted_at is null");
    if (Number(count.rows[0]?.count ?? 0) > 0) {
      console.warn("⚠️  V2 database already has workspaces. Skipping migration.");
      console.warn("   Run: TRUNCATE workspaces CASCADE; to re-migrate.");
      await v1.end();
      await v2.end();
      return report;
    }
  }

  // ── Step 1: Apply v2 schema (if not already applied) ──
  console.log("── Step 1: Apply v2 schema ──");
  if (!v2AlreadyPopulated) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = resolve(
      __dirname,
      "../../../../../packages/db/migrations/v2/001_core_foundation.sql",
    );
    const schemaSql = readFileSync(schemaPath, "utf-8");
    await v2.query(schemaSql);
    console.log("  ✓ v2 schema applied");
  } else {
    console.log("  ✓ v2 schema already exists (skipped)");
  }

  // ── Step 2: Migrate workspaces ──
  console.log();
  console.log("── Step 2: Migrate workspaces ──");
  const v1Workspaces = await v1.query(
    `select id, name, slug, created_at, updated_at, deleted_at from workspaces order by created_at`,
  );
  report.workspaces.v1 = v1Workspaces.rows.length;
  console.log(`  Found ${report.workspaces.v1} workspace(s)`);

  for (const ws of v1Workspaces.rows) {
    try {
      const slug = ws.slug
        ? safeString(ws.slug)
        : `workspace-${safeString(ws.id).slice(0, 8)}`;
      await v2.query(
        `insert into workspaces (id, name, slug, created_at, updated_at, deleted_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set
           name = excluded.name,
           slug = excluded.slug,
           updated_at = excluded.updated_at
         returning id`,
        [
          ws.id,
          ws.name,
          slug,
          toTimestamp(ws.created_at),
          toTimestamp(ws.updated_at),
          ws.deleted_at ?? null,
        ],
      );
      report.workspaces.v2++;
    } catch (err: any) {
      report.workspaces.errors.push(
        `Workspace ${ws.id}: ${err.message ?? err}`,
      );
    }
  }
  console.log(`  ✓ ${report.workspaces.v2} migrated`);

  // ── Step 3: Migrate projects ──
  console.log();
  console.log("── Step 3: Migrate projects ──");
  const v1Projects = await v1.query(
    `select id, workspace_id, name, created_at, updated_at, deleted_at from projects order by created_at`,
  );
  report.projects.v1 = v1Projects.rows.length;
  console.log(`  Found ${report.projects.v1} project(s)`);

  for (const proj of v1Projects.rows) {
    try {
      // Create default project if workspace doesn't exist yet (edge case)
      const wsCheck = await v2.query(
        "select id from workspaces where id = $1",
        [proj.workspace_id],
      );
      if (wsCheck.rows.length === 0) {
        report.warnings.push(
          `Project ${proj.id}: workspace ${proj.workspace_id} not in v2, skipping`,
        );
        continue;
      }
      await v2.query(
        `insert into projects (id, workspace_id, name, created_at, updated_at, deleted_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [
          proj.id,
          proj.workspace_id,
          proj.name || "Default Project",
          toTimestamp(proj.created_at),
          toTimestamp(proj.updated_at),
          proj.deleted_at ?? null,
        ],
      );
      report.projects.v2++;
    } catch (err: any) {
      report.projects.errors.push(
        `Project ${proj.id}: ${err.message ?? err}`,
      );
    }
  }

  // Create default project for workspaces that have boards but no projects
  if (report.projects.v1 === 0) {
    const wsList = await v2.query(
      "select id from workspaces where deleted_at is null",
    );
    for (const ws of wsList.rows) {
      try {
        const projId = randomUUID();
        await v2.query(
          `insert into projects (id, workspace_id, name, created_at, updated_at)
           values ($1, $2, $3, $4, $5) on conflict do nothing`,
          [projId, ws.id, "Default Project", new Date(), new Date()],
        );
        report.projects.v2++;
        report.warnings.push(
          `Created default project ${projId} for workspace ${ws.id} (no projects in v1)`,
        );
      } catch (err: any) {
        report.projects.errors.push(
          `Default project for ${ws.id}: ${err.message ?? err}`,
        );
      }
    }
  }
  console.log(`  ✓ ${report.projects.v2} migrated`);

  // ── Step 4: Migrate boards ──
  console.log();
  console.log("── Step 4: Migrate boards ──");
  const v1Boards = await v1.query(
    `select id, project_id, workspace_id, name, viewport, created_at, updated_at, deleted_at
     from boards order by created_at`,
  );
  report.boards.v1 = v1Boards.rows.length;
  console.log(`  Found ${report.boards.v1} board(s)`);

  for (const board of v1Boards.rows) {
    try {
      // Ensure project exists in v2
      const prjCheck = await v2.query(
        "select id from projects where id = $1",
        [board.project_id],
      );
      if (prjCheck.rows.length === 0) {
        // Create a default project for this board's workspace
        const newProjId = randomUUID();
        await v2.query(
          `insert into projects (id, workspace_id, name, created_at, updated_at)
           values ($1, $2, $3, $4, $5) on conflict do nothing`,
          [
            newProjId,
            board.workspace_id,
            "Migrated Project",
            new Date(),
            new Date(),
          ],
        );
        report.warnings.push(
          `Board ${board.id}: default project ${newProjId} created for workspace ${board.workspace_id}`,
        );
        board.project_id = newProjId;
      }

      const vp = asObject(board.viewport);
      const viewportX = safeNumber(vp.x, 0);
      const viewportY = safeNumber(vp.y, 0);
      const viewportZoom = safeNumber(vp.zoom, 1);

      await v2.query(
        `insert into boards (id, workspace_id, project_id, name,
           viewport_x, viewport_y, viewport_zoom,
           created_at, updated_at, deleted_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do nothing`,
        [
          board.id,
          board.workspace_id,
          board.project_id,
          board.name || "Untitled Board",
          viewportX,
          viewportY,
          viewportZoom,
          toTimestamp(board.created_at),
          toTimestamp(board.updated_at),
          board.deleted_at ?? null,
        ],
      );
      report.boards.v2++;
    } catch (err: any) {
      report.boards.errors.push(`Board ${board.id}: ${err.message ?? err}`);
    }
  }
  console.log(`  ✓ ${report.boards.v2} migrated`);

  // ── Step 5: Migrate card_types ──
  console.log();
  console.log("── Step 5: Migrate card types ──");
  const v1CardTypes = await v1.query(
    `select id, workspace_id, key, name, description, default_data,
            created_at, updated_at
     from card_types order by name`,
  );
  report.cardTypes.v1 = v1CardTypes.rows.length;
  console.log(`  Found ${report.cardTypes.v1} card type(s)`);

  for (const ct of v1CardTypes.rows) {
    try {
      const wsCheck = await v2.query(
        "select id from workspaces where id = $1",
        [ct.workspace_id],
      );
      if (wsCheck.rows.length === 0) {
        report.warnings.push(
          `Card type ${ct.id}: workspace ${ct.workspace_id} not in v2, skipping`,
        );
        continue;
      }

      const defaultData = ct.default_data
        ? JSON.stringify(ct.default_data)
        : "{}";

      await v2.query(
        `insert into card_types (
           id, workspace_id, key, name, description, default_data,
           default_width, default_height, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
         on conflict (id) do nothing`,
        [
          ct.id,
          ct.workspace_id,
          ct.key || "unknown",
          ct.name || "Unknown",
          ct.description || "",
          defaultData,
          300,
          180,
          toTimestamp(ct.created_at),
          toTimestamp(ct.updated_at),
        ],
      );
      report.cardTypes.v2++;
    } catch (err: any) {
      report.cardTypes.errors.push(
        `Card type ${ct.id}: ${err.message ?? err}`,
      );
    }
  }
  console.log(`  ✓ ${report.cardTypes.v2} migrated`);

  // ── Step 6: Migrate card_type_ports ──
  console.log();
  console.log("── Step 6: Migrate card type ports ──");

  // Source A: v1 card_types.allowed_handles
  const v1PortsFromHandles = await v1.query(
    `select id, workspace_id, allowed_handles from card_types`,
  );

  // Source B: cards.data._yadraw (aggregated by type_id)
  const v1CardsForPorts = await v1.query(
    `select type_id, workspace_id, data
     from cards
     where type_id is not null and deleted_at is null`,
  );

  // Build port map: card_type_id → PortDef[] (deduplicated)
  const cardTypePortMap = new Map<string, PortDef[]>();
  const dedupSet = new Map<string, Set<string>>(); // cardTypeId → "direction:key"

  function addPort(cardTypeId: string, port: PortDef) {
    if (!cardTypeId) return;
    const key = `${port.direction}:${port.key}`;
    const seen = dedupSet.get(cardTypeId) ?? new Set();
    if (seen.has(key)) return;
    seen.add(key);
    dedupSet.set(cardTypeId, seen);
    const existing = cardTypePortMap.get(cardTypeId) ?? [];
    existing.push(port);
    cardTypePortMap.set(cardTypeId, existing);
  }

  // Source A: allowed_handles
  for (const row of v1PortsFromHandles.rows) {
    const ctId = safeString(row.id);
    const ports = portsFromAllowedHandles(row.allowed_handles);
    for (const port of ports) {
      addPort(ctId, port);
    }
  }

  // Source B: _yadraw (only supplement if no ports yet from allowed_handles)
  const cardTypesWithHandlesPorts = new Set(
    v1PortsFromHandles.rows
      .filter((r) => {
        const p = portsFromAllowedHandles(r.allowed_handles);
        return p.length > 0;
      })
      .map((r) => safeString(r.id)),
  );

  for (const row of v1CardsForPorts.rows) {
    const ctId = safeString(row.type_id);
    // Don't overwrite ports already from allowed_handles, but DO supplement
    // if allowed_handles had fewer ports than _yadraw
    const rawData = asObject(row.data);
    const yadraw = rawData._yadraw;
    const yadrawPorts = parseYadrawPortDefs(yadraw);
    for (const port of yadrawPorts) {
      addPort(ctId, port);
    }
  }

  // Source C: Check if v1 has card_type_ports table
  const hasV1PortsTable =
    (
      await v1.query(
        `select exists (
          select from information_schema.tables
          where table_schema='public' and table_name='card_type_ports'
        )`,
      )
    ).rows[0]?.exists ?? false;

  if (hasV1PortsTable) {
    const v1PortTable = await v1.query(
      `select * from card_type_ports where deleted_at is null`,
    );
    for (const row of v1PortTable.rows) {
      addPort(safeString(row.card_type_id), {
        key: safeString(row.key),
        label: safeString(row.label),
        direction: row.direction as "input" | "output",
        dataType: safeString(row.data_type, "json"),
        required: !!row.required,
      });
    }
    console.log(`  Found ${v1PortTable.rows.length} ports in v1 card_type_ports`);
  }

  // Sort ports within each type (inputs first, then by sort_order)
  function sortPorts(ports: PortDef[]): PortDef[] {
    return [...ports].sort((a, b) => {
      if (a.direction !== b.direction)
        return a.direction === "input" ? -1 : 1;
      return 0; // preserve insertion order within same direction
    });
  }

  // Write to v2 card_type_ports
  report.cardTypePorts.v1 = Array.from(cardTypePortMap.values()).reduce(
    (sum, p) => sum + p.length,
    0,
  );
  console.log(`  ${report.cardTypePorts.v1} ports to migrate`);

  // Also get workspace_id for each card type
  const ctWorkspaceMap = new Map<string, string>();
  for (const row of v1CardTypes.rows) {
    ctWorkspaceMap.set(safeString(row.id), safeString(row.workspace_id));
  }

  for (const [ctId, ports] of cardTypePortMap.entries()) {
    const sortedPorts = sortPorts(ports);
    const workspaceId = ctWorkspaceMap.get(ctId) || "unknown";
    let portIndex = 0;
    for (const port of sortedPorts) {
      try {
        await v2.query(
          `insert into card_type_ports (
            id, workspace_id, card_type_id, key, label, direction,
            data_type, required, sort_order, created_at, updated_at
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          on conflict (card_type_id, direction, key)
          where deleted_at is null
          do update set
            label = excluded.label,
            data_type = excluded.data_type,
            required = excluded.required,
            sort_order = excluded.sort_order`,
          [
            randomUUID(),
            workspaceId,
            ctId,
            port.key,
            port.label,
            port.direction,
            port.dataType,
            port.required,
            portIndex,
            new Date(),
            new Date(),
          ],
        );
        report.cardTypePorts.v2++;
        portIndex++;
      } catch (err: any) {
        report.cardTypePorts.errors.push(
          `Port ${ctId}/${port.direction}/${port.key}: ${err.message ?? err}`,
        );
      }
    }
  }
  console.log(`  ✓ ${report.cardTypePorts.v2} ports migrated`);

  // ── Step 7: Migrate cards ──
  console.log();
  console.log("── Step 7: Migrate cards ──");
  const v1Cards = await v1.query(
    `select id, workspace_id, board_id, type_id, title, description,
            status, data, position, size, created_at, updated_at, deleted_at
     from cards order by created_at`,
  );
  report.cards.v1 = v1Cards.rows.length;
  console.log(`  Found ${report.cards.v1} card(s)`);

  for (const card of v1Cards.rows) {
    try {
      const pos = asObject(card.position);
      const sz = asObject(card.size);
      const rawData = asObject(card.data);
      // Strip _yadraw
      const { _yadraw, ...cleanData } = rawData;

      const typeId = safeString(card.type_id || card.card_type_id);

      await v2.query(
        `insert into cards (
           id, workspace_id, board_id, card_type_id, title, description,
           data, position_x, position_y, width, height, status,
           created_at, updated_at, deleted_at
         ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (id) do nothing`,
        [
          card.id,
          card.workspace_id,
          card.board_id,
          typeId || null,
          safeString(card.title, "Untitled"),
          safeString(card.description),
          JSON.stringify(cleanData),
          safeNumber(pos.x, 0),
          safeNumber(pos.y, 0),
          safeNumber(sz.width, 300),
          safeNumber(sz.height, 180),
          card.status || "draft",
          toTimestamp(card.created_at),
          toTimestamp(card.updated_at),
          card.deleted_at ?? null,
        ],
      );
      report.cards.v2++;
    } catch (err: any) {
      report.cards.errors.push(`Card ${card.id}: ${err.message ?? err}`);
    }
  }
  console.log(`  ✓ ${report.cards.v2} migrated`);

  // ── Step 8: Migrate connections ──
  console.log();
  console.log("── Step 8: Migrate connections ──");

  // Load connection_types to resolve type_id → type text
  const v1ConnTypes = await v1.query(
    "select id, key from connection_types",
  );
  const connTypeMap = new Map<string, string>();
  for (const ct of v1ConnTypes.rows) {
    connTypeMap.set(safeString(ct.id), safeString(ct.key, "data"));
  }

  // Pre-load v2 card_type_ports for default port fallback
  const v2PortsByType = new Map<string, { inputs: string[]; outputs: string[] }>();
  {
    const portRows = await v2.query(
      `select card_type_id, direction, key from card_type_ports
       where deleted_at is null
       order by card_type_id, direction, sort_order`,
    );
    for (const pr of portRows.rows) {
      const ctId = safeString(pr.card_type_id);
      if (!v2PortsByType.has(ctId)) {
        v2PortsByType.set(ctId, { inputs: [], outputs: [] });
      }
      const entry = v2PortsByType.get(ctId)!;
      if (pr.direction === "input") entry.inputs.push(safeString(pr.key));
      else entry.outputs.push(safeString(pr.key));
    }
  }

  const v1Connections = await v1.query(
    `select id, workspace_id, board_id, source_card_id, target_card_id,
            source_handle, target_handle, type_id, label, status,
            created_at, updated_at, deleted_at
     from connections order by created_at`,
  );
  report.connections.v1 = v1Connections.rows.length;
  console.log(`  Found ${report.connections.v1} connection(s)`);

  for (const conn of v1Connections.rows) {
    try {
      let sourcePortKey = safeString(conn.source_handle || conn.source_port_key);
      let targetPortKey = safeString(conn.target_handle || conn.target_port_key);
      const connType = connTypeMap.get(safeString(conn.type_id)) || "data";
      const connStatus: string =
        conn.status === "active" || conn.status === "disabled"
          ? conn.status
          : "active";

      // If port keys are missing, try to find defaults from v2 card_type_ports
      if (!sourcePortKey || !targetPortKey) {
        // Get the card types for source/target cards
        const srcCard = await v2.query(
          "select card_type_id from cards where id = $1",
          [conn.source_card_id],
        );
        const tgtCard = await v2.query(
          "select card_type_id from cards where id = $1",
          [conn.target_card_id],
        );

        if (!sourcePortKey && srcCard.rows.length > 0) {
          const ctId = safeString(srcCard.rows[0].card_type_id);
          const ctPorts = v2PortsByType.get(ctId);
          if (ctPorts && ctPorts.outputs.length > 0) {
            sourcePortKey = ctPorts.outputs[0] ?? "";
          }
        }

        if (!targetPortKey && tgtCard.rows.length > 0) {
          const ctId = safeString(tgtCard.rows[0].card_type_id);
          const ctPorts = v2PortsByType.get(ctId);
          if (ctPorts && ctPorts.inputs.length > 0) {
            targetPortKey = ctPorts.inputs[0] ?? "";
          }
        }

        if (!sourcePortKey) {
          report.warnings.push(
            `Connection ${conn.id}: could not resolve source_port_key, using "default"`,
          );
          sourcePortKey = "default";
        }
        if (!targetPortKey) {
          report.warnings.push(
            `Connection ${conn.id}: could not resolve target_port_key, using "default"`,
          );
          targetPortKey = "default";
        }
      }

      await v2.query(
        `insert into connections (
           id, workspace_id, board_id, source_card_id, target_card_id,
           source_port_key, target_port_key, type, label, status,
           created_at, updated_at, deleted_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         on conflict (id) do nothing`,
        [
          conn.id,
          conn.workspace_id,
          conn.board_id,
          conn.source_card_id,
          conn.target_card_id,
          sourcePortKey,
          targetPortKey,
          connType,
          safeString(conn.label),
          connStatus,
          toTimestamp(conn.created_at),
          toTimestamp(conn.updated_at),
          conn.deleted_at ?? null,
        ],
      );
      report.connections.v2++;
    } catch (err: any) {
      report.connections.errors.push(
        `Connection ${conn.id}: ${err.message ?? err}`,
      );
    }
  }
  console.log(`  ✓ ${report.connections.v2} migrated`);

  await v1.end();
  await v2.end();

  return report;
}

/* ------------------------------------------------------------------ */
/*  Print Report                                                       */
/* ------------------------------------------------------------------ */

function printReport(report: MigrationReport): void {
  const entries: [string, { v1: number; v2: number; errors: string[] }][] = [
    ["Workspaces", report.workspaces],
    ["Projects", report.projects],
    ["Boards", report.boards],
    ["Card Types", report.cardTypes],
    ["Card Type Ports", report.cardTypePorts],
    ["Cards", report.cards],
    ["Connections", report.connections],
  ];

  console.log();
  console.log("═══════════════════════════════════════════");
  console.log("           MIGRATION REPORT");
  console.log("═══════════════════════════════════════════");
  console.log();
  console.log("  %-22s %6s %6s", "Table", "V1", "V2");
  console.log("  " + "─".repeat(36));

  let totalErrors = 0;
  for (const [name, data] of entries) {
    const label = name.length > 22 ? name.slice(0, 19) + "..." : name;
    console.log(
      "  %-22s %6d %6d",
      label,
      data.v1,
      data.v2,
    );
    totalErrors += data.errors.length;
    for (const err of data.errors) {
      console.log("  ⚠  ERROR: %s", err);
    }
  }
  console.log();

  if (report.warnings.length > 0) {
    console.log("── Warnings ──");
    for (const w of report.warnings) {
      console.log("  ⚡ %s", w);
    }
    console.log();
  }

  if (totalErrors > 0) {
    console.log("❌ %d error(s) during migration — review above.", totalErrors);
  } else {
    console.log("✅ Migration complete — all tables migrated successfully.");
  }

  console.log();
  console.log("Next steps:");
  console.log("  1. Run: npm run v2:verify");
  console.log("  2. Update .env: YADRAW_V2_STORAGE=v2-postgres");
  console.log("  3. Restart PM2 processes");
}

/* ------------------------------------------------------------------ */
/*  Entry Point                                                        */
/* ------------------------------------------------------------------ */

runMigration()
  .then((report) => {
    printReport(report);
    process.exit(
      report.workspaces.errors.length +
        report.projects.errors.length +
        report.boards.errors.length +
        report.cardTypes.errors.length +
        report.cardTypePorts.errors.length +
        report.cards.errors.length +
        report.connections.errors.length >
        0
        ? 1
        : 0,
    );
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
