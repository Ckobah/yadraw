import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { config } from "dotenv";
import { demoIds, demoUserIds } from "@yadraw/shared";
import { createPostgresRepository, type BoardRepository } from "./repository.js";

config({ path: new URL("../../../.env", import.meta.url) });
config();

const databaseUrl = process.env.DATABASE_URL_TEST;
const describePostgres = databaseUrl ? describe : describe.skip;

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations"
);

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function withSearchPath(connectionString: string, schemaName: string): string {
  const url = new URL(connectionString);
  const searchPathOption = `-c search_path=${schemaName},public`;
  const existingOptions = url.searchParams.get("options");
  url.searchParams.set("options", existingOptions ? `${existingOptions} ${searchPathOption}` : searchPathOption);
  return url.toString();
}

async function runMigrations(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const migrationFiles = (await readdir(migrationsDir))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    for (const filename of migrationFiles) {
      await client.query(await readFile(join(migrationsDir, filename), "utf8"));
    }
  } finally {
    await client.end();
  }
}

async function seedWorkspaceMembers(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(
      `
        insert into workspace_members (workspace_id, user_id, role)
        values
          ($1, $2, 'owner'),
          ($1, $3, 'editor'),
          ($1, $4, 'viewer')
        on conflict (workspace_id, user_id) do update
        set role = excluded.role
      `,
      [demoIds.workspace, demoUserIds.owner, demoUserIds.editor, demoUserIds.viewer]
    );
  } finally {
    await client.end();
  }
}

describePostgres("postgres repository smoke", () => {
  const schemaName = `yadraw_smoke_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = quoteIdentifier(schemaName);
  let isolatedDatabaseUrl = "";
  let repository: BoardRepository | null = null;

  beforeAll(async () => {
    if (!databaseUrl) return;

    const adminClient = new Client({ connectionString: databaseUrl });
    await adminClient.connect();

    try {
      await adminClient.query(`create schema ${quotedSchemaName}`);
    } finally {
      await adminClient.end();
    }

    isolatedDatabaseUrl = withSearchPath(databaseUrl, schemaName);
    await runMigrations(isolatedDatabaseUrl);
    await seedWorkspaceMembers(isolatedDatabaseUrl);
    repository = await createPostgresRepository(isolatedDatabaseUrl);
  }, 30_000);

  afterAll(async () => {
    await repository?.close?.();

    if (!databaseUrl) return;

    const adminClient = new Client({ connectionString: databaseUrl });
    await adminClient.connect();

    try {
      await adminClient.query(`drop schema if exists ${quotedSchemaName} cascade`);
    } finally {
      await adminClient.end();
    }
  }, 30_000);

  it("reads the migrated and seeded board", async () => {
    const board = await repository?.getBoard(demoIds.board);

    expect(board).toMatchObject({
      id: demoIds.board,
      workspaceId: demoIds.workspace,
      cards: expect.any(Array),
      connections: expect.any(Array)
    });
    expect(board?.cards.length).toBeGreaterThan(0);
    expect(board?.connections.length).toBeGreaterThan(0);
  });

  it("resolves workspace roles through real tables", async () => {
    await expect(repository?.getBoardRole(demoUserIds.owner, demoIds.board)).resolves.toBe("owner");
    await expect(repository?.getBoardRole(demoUserIds.editor, demoIds.board)).resolves.toBe("editor");
    await expect(repository?.getBoardRole(demoUserIds.viewer, demoIds.board)).resolves.toBe("viewer");
  });

  it("creates, updates, searches, deletes, and restores a card", async () => {
    const created = await repository?.createCard(demoIds.board, {
      title: "Postgres smoke card",
      typeKey: "note",
      data: { smoke: true },
      tags: ["smoke"]
    });

    expect(created).toMatchObject({
      title: "Postgres smoke card",
      data: { smoke: true },
      tags: ["smoke"]
    });

    const updated = await repository?.updateCard(created?.id ?? "", {
      title: "Postgres smoke card updated",
      position: { x: 412, y: 224 }
    });

    expect(updated).toMatchObject({
      title: "Postgres smoke card updated",
      position: { x: 412, y: 224 }
    });

    const results = await repository?.searchCards("smoke", demoIds.board);
    expect(results?.some((card) => card.id === created?.id)).toBe(true);

    await expect(repository?.deleteCard(created?.id ?? "")).resolves.toMatchObject({
      id: created?.id
    });
    await expect(repository?.restoreCard(created?.id ?? "")).resolves.toMatchObject({
      id: created?.id
    });
  });
});
