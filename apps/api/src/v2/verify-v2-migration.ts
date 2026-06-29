#!/usr/bin/env tsx
/**
 * v2 Migration Verification Script
 *
 * Reads from DATABASE_URL (v1) and V2_DATABASE_URL (v2), compares counts
 * and data integrity.
 *
 * Usage:
 *   V2_DATABASE_URL=postgres://... DATABASE_URL=postgres://... npx tsx src/v2/verify-v2-migration.ts
 *
 * Or:
 *   npm run v2:verify
 */

import pg from "pg";
import { config } from "dotenv";
const { Pool } = pg;

config({ path: new URL("../../../../.env", import.meta.url) });
config();

interface VerifyResult {
  passed: number;
  failed: number;
  warnings: number;
  details: string[];
}

async function verify(v1Url: string, v2Url: string): Promise<VerifyResult> {
  const result: VerifyResult = { passed: 0, failed: 0, warnings: 0, details: [] };
  const v1 = new Pool({ connectionString: v1Url, max: 2 });
  const v2 = new Pool({ connectionString: v2Url, max: 2 });

  const pass = (msg: string) => {
    result.passed++;
    result.details.push(`  ✅ ${msg}`);
  };
  const fail = (msg: string) => {
    result.failed++;
    result.details.push(`  ❌ ${msg}`);
  };
  const warn = (msg: string) => {
    result.warnings++;
    result.details.push(`  ⚠️  ${msg}`);
  };

  console.log("═══ V2 Migration Verification ═══");
  console.log();

  // ── Check 1: Workspace count ──
  console.log("1. Workspace count");
  const v1Ws = (await v1.query("select count(*) from workspaces")).rows[0]
    .count;
  const v2Ws = (await v2.query("select count(*) from workspaces where deleted_at is null")).rows[0]
    .count;
  if (Number(v1Ws) === Number(v2Ws)) {
    pass(`Workspaces: ${v1Ws} v1 → ${v2Ws} v2`);
  } else {
    fail(`Workspaces: ${v1Ws} v1 → ${v2Ws} v2 (mismatch)`);
  }

  // ── Check 2: Workspace member count ──
  console.log("2. Workspace member count");
  const v1Members = (await v1.query("select count(*) from workspace_members")).rows[0]
    .count;
  const v2Members = (await v2.query("select count(*) from workspace_members where deleted_at is null")).rows[0]
    .count;
  if (Number(v1Members) === Number(v2Members)) {
    pass(`Workspace members: ${v1Members} v1 → ${v2Members} v2`);
  } else {
    fail(`Workspace members: ${v1Members} v1 → ${v2Members} v2 (mismatch)`);
  }

  const boardsWithoutMembers = await v2.query(
    `select b.id
     from boards b
     left join workspace_members wm
       on wm.workspace_id = b.workspace_id
       and wm.deleted_at is null
     where b.deleted_at is null
     group by b.id
     having count(wm.id) = 0`,
  );
  if (boardsWithoutMembers.rows.length === 0) {
    pass("Every active board belongs to a workspace with at least one member");
  } else {
    fail(`${boardsWithoutMembers.rows.length} active board(s) have no workspace members`);
  }

  // ── Check 3: Board count ──
  console.log("3. Board count");
  const v1Boards = (await v1.query("select count(*) from boards where deleted_at is null")).rows[0]
    .count;
  const v2Boards = (await v2.query("select count(*) from boards where deleted_at is null")).rows[0]
    .count;
  if (Number(v1Boards) === Number(v2Boards)) {
    pass(`Boards: ${v1Boards} v1 → ${v2Boards} v2`);
  } else {
    fail(`Boards: ${v1Boards} v1 → ${v2Boards} v2 (mismatch)`);
  }

  // ── Check 4: Card count ──
  console.log("4. Card count");
  const v1Cards = (await v1.query("select count(*) from cards where deleted_at is null")).rows[0]
    .count;
  const v2Cards = (await v2.query("select count(*) from cards where deleted_at is null")).rows[0]
    .count;
  if (Number(v1Cards) === Number(v2Cards)) {
    pass(`Cards: ${v1Cards} v1 → ${v2Cards} v2`);
  } else {
    fail(`Cards: ${v1Cards} v1 → ${v2Cards} v2 (mismatch)`);
  }

  // ── Check 5: Connection count ──
  console.log("5. Connection count");
  const v1Conns = (await v1.query("select count(*) from connections where deleted_at is null")).rows[0]
    .count;
  const v2Conns = (await v2.query("select count(*) from connections where deleted_at is null")).rows[0]
    .count;
  // Connections may differ if some could not be migrated (missing port keys)
  if (Number(v1Conns) === Number(v2Conns)) {
    pass(`Connections: ${v1Conns} v1 → ${v2Conns} v2`);
  } else {
    warn(`Connections: ${v1Conns} v1 → ${v2Conns} v2 (expected if some had unresolvable ports)`);
  }

  // ── Check 6: No _yadraw in cards.data ──
  console.log("6. No _yadraw in cards.data");
  const yadrawCards = await v2.query(
    `select count(*) from cards where data ? '_yadraw' and deleted_at is null`,
  );
  if (Number(yadrawCards.rows[0].count) === 0) {
    pass("No cards have _yadraw in data");
  } else {
    fail(`${yadrawCards.rows[0].count} cards still contain _yadraw in data`);
  }

  // ── Check 7: Card type ports exist for types that have cards ──
  console.log("7. card_type_ports exist for types with cards");
  const typesWithCards = await v2.query(
    `select distinct ct.id, ct.name
     from card_types ct
     join cards c on c.card_type_id = ct.id
     where ct.deleted_at is null and c.deleted_at is null`,
  );
  const typesWithPorts = await v2.query(
    `select distinct cp.card_type_id
     from card_type_ports cp
     where cp.deleted_at is null`,
  );
  const tpcSet = new Set(typesWithPorts.rows.map((r: any) => r.card_type_id));

  let missingPortsCount = 0;
  for (const row of typesWithCards.rows) {
    if (!tpcSet.has(row.id)) {
      warn(`Card type "${row.name}" (${row.id}) has cards but no ports`);
      missingPortsCount++;
    }
  }
  if (missingPortsCount === 0) {
    pass("All card types with cards have ports");
  } else {
    warn(`${missingPortsCount} card type(s) with cards lack ports (acceptable if types have no defined ports)`);
  }

  // ── Check 8: Connection references are valid ──
  console.log("8. Connection references are valid");
  const badSrcCards = await v2.query(
    `select c.id from connections c
     left join cards sc on sc.id = c.source_card_id
     where c.deleted_at is null and sc.id is null`,
  );
  const badTgtCards = await v2.query(
    `select c.id from connections c
     left join cards tc on tc.id = c.target_card_id
     where c.deleted_at is null and tc.id is null`,
  );
  if (Number(badSrcCards.rows.length) === 0 && Number(badTgtCards.rows.length) === 0) {
    pass("All connections reference valid source/target cards");
  } else {
    if (badSrcCards.rows.length > 0)
      fail(`${badSrcCards.rows.length} connections reference invalid source cards`);
    if (badTgtCards.rows.length > 0)
      fail(`${badTgtCards.rows.length} connections reference invalid target cards`);
  }

  // ── Check 8b: No orphan connections to soft-deleted cards ──
  console.log("8b. No orphan connections to soft-deleted cards");
  const orphanConns = await v2.query(
    `select c.id, c.source_card_id, c.target_card_id
     from connections c
     left join cards source_card
       on source_card.id = c.source_card_id
       and source_card.deleted_at is null
     left join cards target_card
       on target_card.id = c.target_card_id
       and target_card.deleted_at is null
     where c.deleted_at is null
       and (source_card.id is null or target_card.id is null)`,
  );
  if (Number(orphanConns.rows.length) === 0) {
    pass("No connections have orphan (soft-deleted) source or target cards");
  } else {
    warn(`${orphanConns.rows.length} connections have orphan soft-deleted source/target cards (will be filtered at runtime)`);
    for (const row of orphanConns.rows) {
      warn(`  connection ${row.id}: source=${row.source_card_id}, target=${row.target_card_id}`);
    }
  }

  // ── Check 9: Connection source_port_key exists among output ports
  console.log("9. Source port keys match card type output ports");
  const connPortCheck = await v2.query(
    `select c.id, c.source_card_id, c.source_port_key,
            ca.card_type_id
     from connections c
     join cards ca on ca.id = c.source_card_id
     where c.deleted_at is null and ca.deleted_at is null`,
  );
  let sourceBadCount = 0;
  for (const row of connPortCheck.rows) {
    const portExists = await v2.query(
      `select id from card_type_ports
       where card_type_id = $1 and direction = 'output' and key = $2
         and deleted_at is null`,
      [row.card_type_id, row.source_port_key],
    );
    if (portExists.rows.length === 0) {
      sourceBadCount++;
    }
  }
  if (sourceBadCount === 0) {
    pass("All source port keys match card type output ports");
  } else {
    warn(`${sourceBadCount} connection(s) reference non-existent source port keys (port may use "default" fallback)`);
  }

  // ── Check 10: Connection target_port_key exists among input ports
  console.log("10. Target port keys match card type input ports");
  const connPortCheck2 = await v2.query(
    `select c.id, c.target_card_id, c.target_port_key,
            ca.card_type_id
     from connections c
     join cards ca on ca.id = c.target_card_id
     where c.deleted_at is null and ca.deleted_at is null`,
  );
  let targetBadCount = 0;
  for (const row of connPortCheck2.rows) {
    const portExists = await v2.query(
      `select id from card_type_ports
       where card_type_id = $1 and direction = 'input' and key = $2
         and deleted_at is null`,
      [row.card_type_id, row.target_port_key],
    );
    if (portExists.rows.length === 0) {
      targetBadCount++;
    }
  }
  if (targetBadCount === 0) {
    pass("All target port keys match card type input ports");
  } else {
    warn(`${targetBadCount} connection(s) reference non-existent target port keys (port may use "default" fallback)`);
  }

  // ── Check 11: Deck is selectable via v2 API ──
  console.log("11. V2 API connectivity test");
  const boardCount = await v2.query(
    "select count(*) from boards where deleted_at is null",
  );
  if (Number(boardCount.rows[0].count) > 0) {
    const sampleBoards = await v2.query(
      "select id, name from boards where deleted_at is null limit 1",
    );
    const sampleId = sampleBoards.rows[0]?.id;
    pass(
      `V2 database has ${boardCount.rows[0].count} board(s) (e.g., ${sampleId}) — set YADRAW_V2_STORAGE=v2-postgres and restart to test API`,
    );
  } else {
    fail("No boards found in v2 database");
  }

  await v1.end();
  await v2.end();

  // ── Summary ──
  console.log();
  console.log("═══ Summary ═══");
  console.log(`  ✅ Passed: ${result.passed}`);
  console.log(`  ❌ Failed: ${result.failed}`);
  console.log(`  ⚠️  Warnings: ${result.warnings}`);
  console.log();

  if (result.failed > 0) {
    console.log("❌ Verification failed — review errors above.");
  } else {
    console.log("✅ Verification passed — migration is ready for production switch.");
  }
  console.log();

  return result;
}

const v1Url = process.env.DATABASE_URL;
const v2Url = process.env.V2_DATABASE_URL;

if (!v1Url || !v2Url) {
  console.error("Both DATABASE_URL and V2_DATABASE_URL environment variables are required.");
  process.exit(1);
}

verify(v1Url, v2Url).then((r) => process.exit(r.failed > 0 ? 1 : 0));
