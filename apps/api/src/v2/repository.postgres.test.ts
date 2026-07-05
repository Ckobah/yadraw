import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { config } from "dotenv";
import { createV2PostgresRepository, type V2Repository } from "./repository.js";
import { createV2BoardService } from "./service.js";

config({ path: new URL("../../../../.env", import.meta.url) });
config();

const databaseUrl = process.env.DATABASE_URL_TEST;
const describePostgres = databaseUrl ? describe : describe.skip;
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/migrations/v2"
);
const seedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/seeds/v2_local_seed.sql"
);

const ownerContext = {
  userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  source: "dev" as const
};
const viewerContext = {
  userId: "9f18a762-53e5-4922-9b0b-8f168921bb0f",
  source: "dev" as const
};

const seedIds = {
  workspace: "11111111-1111-4111-8111-111111111111",
  board: "33333333-3333-4333-8333-333333333333",
  sourceType: "44444444-4444-4444-8444-444444444444",
  taskType: "55555555-5555-4555-8555-555555555555"
} as const;

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

async function applySqlFiles(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const migrationFiles = (await readdir(migrationsDir))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    for (const filename of migrationFiles) {
      await client.query(await readFile(join(migrationsDir, filename), "utf8"));
    }

    await client.query(await readFile(seedPath, "utf8"));
  } finally {
    await client.end();
  }
}

describePostgres("v2 Postgres repository", () => {
  const schemaName = `yadraw_v2_smoke_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = quoteIdentifier(schemaName);
  let isolatedDatabaseUrl = "";
  let repository: V2Repository | null = null;

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
    await applySqlFiles(isolatedDatabaseUrl);
    repository = createV2PostgresRepository(isolatedDatabaseUrl);
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

  it("resolves workspace roles through real v2 membership rows", async () => {
    await expect(repository?.getBoardRole(ownerContext.userId, seedIds.board)).resolves.toBe("owner");
    await expect(repository?.getBoardRole(viewerContext.userId, seedIds.board)).resolves.toBe("viewer");
    await expect(repository?.getWorkspaceRole(ownerContext.userId, seedIds.workspace)).resolves.toBe("owner");
  });

  it("persists the authorized core board workflow", async () => {
    if (!repository) throw new Error("Repository was not initialized");
    const service = createV2BoardService(repository);

    const initialBoard = await service.getBoard(ownerContext, seedIds.board);
    expect(initialBoard).toMatchObject({
      workspace: { id: seedIds.workspace },
      board: { id: seedIds.board },
      cardTypes: expect.arrayContaining([
        expect.objectContaining({ id: seedIds.sourceType, key: "source", schema: { fields: [] } }),
        expect.objectContaining({ id: seedIds.taskType, key: "task", schema: { fields: [] } })
      ])
    });

    await expect(service.listCardTypes(ownerContext, seedIds.workspace)).resolves.toMatchObject({
      cardTypes: expect.arrayContaining([
        expect.objectContaining({ id: seedIds.sourceType, schema: { fields: [] } })
      ])
    });

    const source = await service.createCard(ownerContext, seedIds.board, {
      cardTypeId: seedIds.sourceType,
      title: `Source ${Date.now()}`,
      data: { endpoint: "/hook" },
      position: { x: 120, y: 160 }
    });
    const task = await service.createCard(ownerContext, seedIds.board, {
      cardTypeId: seedIds.taskType,
      title: `Task ${Date.now()}`,
      data: { operation: "normalize" },
      position: { x: 480, y: 160 }
    });

    const connection = await service.createConnection(ownerContext, seedIds.board, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      label: "payload"
    });

    await expect(
      service.updateCard(ownerContext, task.id, {
        data: { operation: "normalize", reviewed: true }
      })
    ).resolves.toMatchObject({
      id: task.id,
      data: { operation: "normalize", reviewed: true }
    });

    await expect(service.getBoard(ownerContext, seedIds.board)).resolves.toMatchObject({
      cards: expect.arrayContaining([
        expect.objectContaining({ id: source.id }),
        expect.objectContaining({ id: task.id, data: { operation: "normalize", reviewed: true } })
      ]),
      connections: expect.arrayContaining([expect.objectContaining({ id: connection.id })])
    });

    await expect(service.deleteCard(ownerContext, source.id)).resolves.toEqual({
      deleted: true,
      id: source.id
    });

    const afterDelete = await service.getBoard(ownerContext, seedIds.board);
    expect(afterDelete.cards.map((card) => card.id)).not.toContain(source.id);
    expect(afterDelete.connections.map((item) => item.id)).not.toContain(connection.id);
    await expect(repository.getConnection(connection.id)).resolves.toBeNull();

    await service.deleteCard(ownerContext, task.id);
  });

  it("rejects viewer writes in the repository-backed service", async () => {
    if (!repository) throw new Error("Repository was not initialized");
    const service = createV2BoardService(repository);

    await expect(service.getBoard(viewerContext, seedIds.board)).resolves.toMatchObject({
      board: { id: seedIds.board }
    });
    await expect(
      service.createCard(viewerContext, seedIds.board, {
        cardTypeId: seedIds.sourceType
      })
    ).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("filters orphan connections when a card is soft-deleted outside the normal delete path", async () => {
    if (!repository) throw new Error("Repository was not initialized");
    const service = createV2BoardService(repository);

    const source = await service.createCard(ownerContext, seedIds.board, {
      cardTypeId: seedIds.sourceType,
      title: `orphan-test-source ${Date.now()}`,
      data: {},
      position: { x: 0, y: 0 }
    });
    const task = await service.createCard(ownerContext, seedIds.board, {
      cardTypeId: seedIds.taskType,
      title: `orphan-test-task ${Date.now()}`,
      data: {},
      position: { x: 300, y: 0 }
    });

    const connection = await service.createConnection(ownerContext, seedIds.board, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      label: "orphan-edge"
    });

    const client = new Client({ connectionString: isolatedDatabaseUrl });
    await client.connect();
    try {
      await client.query("update cards set deleted_at = now() where id = $1 and deleted_at is null", [task.id]);
    } finally {
      await client.end();
    }

    const detail = await repository.getBoardDetail(seedIds.board);
    expect(detail).not.toBeNull();
    expect(detail!.cards.map((card) => card.id)).toContain(source.id);
    expect(detail!.cards.map((card) => card.id)).not.toContain(task.id);
    expect(detail!.connections.map((conn) => conn.id)).not.toContain(connection.id);

    await service.deleteCard(ownerContext, source.id);
  });
});
