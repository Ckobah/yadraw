# V2 Migration Guide

## Overview

This guide describes how to migrate Yadraw's v1 PostgreSQL database to the strict v2 schema.

The migration is a one-way process: it reads from the v1 database (`DATABASE_URL`) and writes to the v2 database (`V2_DATABASE_URL`). The v1 database is **not modified**.

After migration, Yadraw runs with `YADRAW_V2_STORAGE=v2-postgres` instead of the temporary `legacy-postgres` adapter.

## Prerequisites

- Node.js 18+ (for `tsx`)
- Access to the v1 database (via `DATABASE_URL`)
- A **separate** v2 database (via `V2_DATABASE_URL`) — this must be an empty database or one that already has the v2 schema applied
- Environment variables set in `.env` or exported

## 1. Backup

Always back up both databases before migration:

```bash
# Backup v1 (production)
pg_dump "$DATABASE_URL" > yadraw_v1_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup v2 (target) — if already populated
pg_dump "$V2_DATABASE_URL" > yadraw_v2_backup_$(date +%Y%m%d_%H%M%S).sql
```

## 2. Environment Variables

Ensure both `DATABASE_URL` and `V2_DATABASE_URL` are set:

```bash
export DATABASE_URL="postgres://user:pass@host:5432/yadraw_v1"
export V2_DATABASE_URL="postgres://user:pass@host:5432/yadraw_v2"
```

Or add them to `.env`:

```
DATABASE_URL=postgres://yadraw:***@127.0.0.1:5433/yadraw
V2_DATABASE_URL=postgres://yadraw:***@127.0.0.1:5434/yadraw_v2
```

## 3. Migration Command

```bash
npm run v2:migrate --workspace @yadraw/api
```

The script:

1. Applies the v2 schema (`packages/db/migrations/v2/001_core_foundation.sql`) to the v2 database if not already applied.
2. Reads all workspaces, projects, boards, card types, cards, and connections from v1.
3. Transforms and writes them to v2 tables.
4. Prints a migration report with row counts per table.

### What is migrated

| v1 (source) | v2 (target) | Mapping notes |
|---|---|---|
| `workspaces` | `workspaces` | Keeps same IDs; slug defaults to `workspace-<uuid>` if missing |
| `projects` | `projects` | Keeps same IDs; creates default project if none exist |
| `boards.viewport` (jsonb) | `boards.viewport_x`, `boards.viewport_y`, `boards.viewport_zoom` | Defaults: x=0, y=0, zoom=1 |
| `card_types` | `card_types` | Adds `default_width=300`, `default_height=180` |
| `card_types.allowed_handles` + `cards.data._yadraw` | `card_type_ports` | Aggregated by card_type_id, deduplicated by (direction, key) |
| `cards.type_id` | `cards.card_type_id` | Renamed column |
| `cards.position` (jsonb) | `cards.position_x`, `cards.position_y` | Defaults: x=0, y=0 |
| `cards.size` (jsonb) | `cards.width`, `cards.height` | Defaults: width=300, height=180 |
| `cards.data._yadraw` | — | **Stripped** from cards.data |
| `connections.source_handle` | `connections.source_port_key` | Falls back to first output port of source card type |
| `connections.target_handle` | `connections.target_port_key` | Falls back to first input port of target card type |
| `connections.type_id` | `connections.type` (text) | Resolved via `connection_types.key` |

### Port recovery algorithm

Ports in `card_type_ports` are built from three sources (in priority order):

1. **v1 `card_type_ports` table** (if it exists and has data)
2. **v1 `card_types.allowed_handles`** (jsonb with input/output structure)
3. **`cards.data._yadraw.inputs/outputs`** (aggregated per card_type_id)

All ports are deduplicated by `(card_type_id, direction, key)`. Sources 1 and 2 take priority; source 3 supplements missing ports.

### Card data cleanup

The `_yadraw` object is removed from `cards.data` before writing to v2. This includes tags, typeKey, files metadata, and any other internal app state stored at `data._yadraw`. The v2 schema has a CHECK constraint (`cards_data_no_internal_yadraw`) preventing `_yadraw` from being stored.

## 4. Verification Command

```bash
npm run v2:verify --workspace @yadraw/api
```

The verification script checks:

1. ✅ Workspace counts match between v1 and v2
2. ✅ Board counts match
3. ✅ Card counts match
4. ✅ Connection counts match (or explains discrepancies)
5. ✅ No `_yadraw` in any card's `data` field
6. ✅ All card types with cards have ports
7. ✅ All connections reference valid source/target cards
8. ✅ All source port keys exist in card type output ports
9. ✅ All target port keys exist in card type input ports
10. ✅ V2 database has boards ready for API

## 5. Switch Production to v2-postgres

After successful verification:

1. **Update `.env`:**

```
YADRAW_V2_STORAGE=v2-postgres
V2_DATABASE_URL=<your_v2_database_url>
```

2. **Restart processes:**

```bash
pm2 restart yadraw-api
pm2 restart yadraw-web
```

3. **Verify API:**

```bash
curl -H "x-yadraw-user-id: dev" https://yadraw.com/api/v2/boards/<board-id>
```

You should receive a valid board response with `cardTypes[].ports` and clean `cards[].data`.

## 6. Rollback Plan

If something goes wrong after switching to v2-postgres:

> **⚠️ IMPORTANT:** `legacy-postgres` adapter reads the **v1 schema**. Therefore `V2_DATABASE_URL` must point to the v1 database when using `legacy-postgres`, and to the v2 database when using `v2-postgres`. A mismatch will cause schema errors.

### Option A: Switch back to legacy-postgres

**Do not use `legacy-postgres` in production after successful v2 migration. It is a migration-only fallback for emergencies.**

```bash
# 1. Restore .env:
YADRAW_V2_STORAGE=legacy-postgres
V2_DATABASE_URL=<v1_database_url>    # ← MUST point to v1 database, NOT v2!
#                                    #   legacy-postgres reads v1 schema

# 2. Restart:
pm2 restart yadraw-api

# 3. Verify old API:
curl -H "x-yadraw-user-id: dev" https://yadraw.com/api/v2/boards/<board-id>
```

### Option B: Restore from backup

```bash
# 1. Drop and recreate v2 database
dropdb yadraw_v2
createdb yadraw_v2

# 2. Restore from backup
pg_dump "$DATABASE_URL" > v1_backup.sql    # if v1 is still intact
psql "$V2_DATABASE_URL" < v1_backup.sql    # rebuild

# 3. Run migration again with fixes
npm run v2:migrate --workspace @yadraw/api
```

## 7. Post-Migration Cleanup

After successful production run with `v2-postgres`:

### Legacy adapter

The `legacy-postgres` adapter (`repository.legacy-postgres.ts`) is kept for reference but must **not** be used as production runtime. Remove from `index.ts`:

```diff
- import { createV2LegacyPostgresRepository } from "./v2/repository.legacy-postgres.js";
```

And remove the `"legacy-postgres"` branch from `createV2Repository()`.

### v1 database

The v1 database can be kept as a backup or decommissioned after sufficient burn-in.

## Migration Architecture

```
v1 PostgreSQL (DATABASE_URL)
        │
        ▼
apps/api/src/v2/migrate-v1-to-v2.ts
        │
        ├── Apply v2 schema (001_core_foundation.sql)
        ├── Read workspaces, projects, boards, card_types, cards, connections
        ├── Transform to v2 format (unpack JSON, strip _yadraw, resolve FKs)
        ├── Write to v2 tables
        └── Print migration report
        │
        ▼
v2 PostgreSQL (V2_DATABASE_URL)
        │
        ▼
apps/api/src/v2/verify-v2-migration.ts
        │
        └── Validate counts, integrity, API readiness
        │
        ▼
YADRAW_V2_STORAGE=v2-postgres → strict v2 repository (repository.ts)
```
