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

  it("backfills users and workspace ownership", async () => {
    const client = new Client({ connectionString: isolatedDatabaseUrl });
    await client.connect();
    try {
      const users = await client.query(`select count(*)::int as count from users where deleted_at is null`);
      const owner = await client.query(
        `select owner_user_id from workspaces where id = $1 and deleted_at is null`,
        [seedIds.workspace]
      );
      expect(Number(users.rows[0]?.count)).toBeGreaterThanOrEqual(3);
      expect(String(owner.rows[0]?.owner_user_id)).toBe(ownerContext.userId);
    } finally {
      await client.end();
    }
  });

  it("returns active attachment counts with the board detail", async () => {
    if (!repository?.createCardAttachment || !repository.detachCardAttachment) {
      throw new Error("Attachment repository was not initialized");
    }
    const before = await repository.getBoardDetail(seedIds.board);
    const card = before?.cards[0];
    if (!card) throw new Error("Seed card was not found");

    const attachment = await repository.createCardAttachment({
      fileId: randomUUID(),
      cardId: card.id,
      workspaceId: card.workspaceId,
      storageBucket: "test",
      storagePath: `tests/${randomUUID()}.txt`,
      filename: "counted.txt",
      mimeType: "text/plain",
      sizeBytes: 7,
      createdBy: ownerContext.userId
    });

    await expect(repository.getBoardDetail(seedIds.board)).resolves.toMatchObject({
      cardAttachmentCounts: { [card.id]: 1 }
    });
    await repository.detachCardAttachment(card.id, attachment.id);
    await expect(repository.getBoardDetail(seedIds.board)).resolves.toMatchObject({
      cardAttachmentCounts: { [card.id]: 0 }
    });
  });

  it("bootstraps one isolated personal workspace and demo copy", async () => {
    if (!repository) throw new Error("Repository was not initialized");
    const service = createV2BoardService(repository);
    const userId = randomUUID();
    const context = { userId, source: "header" as const };
    const profile = {
      email: `${userId}@example.com`,
      name: "Personal owner",
      avatarUrl: null,
      authProvider: "supabase" as const
    };

    const original = await service.getBoard(ownerContext, seedIds.board);
    const first = await service.bootstrapSession(context, profile);
    const second = await service.bootstrapSession(context, profile);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.workspace.id).toBe(first.workspace.id);
    expect(second.board?.id).toBe(first.board?.id);
    expect(first.workspace.role).toBe("owner");
    expect(first.board).not.toBeNull();

    const copy = await service.getBoard(context, first.board!.id);
    expect(copy.cards).toHaveLength(original.cards.length);
    expect(copy.cardTypes).toHaveLength(original.cardTypes.length);
    expect(copy.connections).toHaveLength(original.connections.length);
    expect(copy.cards.map((card) => card.id)).not.toEqual(original.cards.map((card) => card.id));
    await expect(service.getBoard(ownerContext, first.board!.id)).rejects.toMatchObject({
      code: "forbidden"
    });

    const workspaces = await service.listWorkspaces(context);
    const boards = await service.listWorkspaceBoards(context, first.workspace.id);
    expect(workspaces.workspaces.map((workspace) => workspace.id)).toContain(first.workspace.id);
    expect(boards.boards.map((board) => board.id)).toContain(first.board!.id);

    const createdBoard = await service.createBoard(context, first.workspace.id, { name: "Blank board" });
    expect(createdBoard).toMatchObject({ workspaceId: first.workspace.id, name: "Blank board" });

    const client = new Client({ connectionString: isolatedDatabaseUrl });
    await client.connect();
    try {
      const copiedFiles = await client.query(
        `select count(*)::int as count from card_files where workspace_id = $1 and deleted_at is null`,
        [first.workspace.id]
      );
      const originalAfter = await client.query(
        `select count(*)::int as count from cards where board_id = $1 and deleted_at is null`,
        [seedIds.board]
      );
      expect(Number(copiedFiles.rows[0]?.count)).toBe(0);
      expect(Number(originalAfter.rows[0]?.count)).toBe(original.cards.length);
    } finally {
      await client.end();
    }
  });

  it("serializes concurrent first-login bootstrap calls", async () => {
    if (!repository) throw new Error("Repository was not initialized");
    const service = createV2BoardService(repository);
    const userId = randomUUID();
    const context = { userId, source: "header" as const };
    const profile = {
      email: `${userId}@example.com`,
      name: "Concurrent owner",
      avatarUrl: null,
      authProvider: "supabase" as const
    };
    const results = await Promise.all([
      service.bootstrapSession(context, profile),
      service.bootstrapSession(context, profile)
    ]);
    expect(new Set(results.map((result) => result.workspace.id)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
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
    await expect(service.listWorkspaceBoards(viewerContext, seedIds.workspace)).resolves.toMatchObject({
      boards: expect.arrayContaining([expect.objectContaining({ id: seedIds.board })])
    });
    await expect(
      service.createBoard(viewerContext, seedIds.workspace, { name: "Viewer board" })
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("commits or rolls back a complete board layout batch", async () => {
    if (!repository) throw new Error("Repository was not initialized");
    const service = createV2BoardService(repository);
    const source = await service.createCard(ownerContext, seedIds.board, {
      cardTypeId: seedIds.sourceType,
      position: { x: 30, y: 40 }
    });
    const task = await service.createCard(ownerContext, seedIds.board, {
      cardTypeId: seedIds.taskType,
      position: { x: 330, y: 40 }
    });
    const connection = await service.createConnection(ownerContext, seedIds.board, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });
    const visualStyle = {
      routeMode: "manual" as const,
      waypoints: [{ x: 240, y: 180 }],
      labelPosition: { x: 250, y: 160 }
    };

    await expect(
      service.updateBoardLayout(ownerContext, seedIds.board, {
        cards: [
          { id: source.id, position: { x: 130, y: 140 } },
          { id: task.id, position: { x: 430, y: 140 } }
        ],
        connections: [{ id: connection.id, visualStyle }]
      })
    ).resolves.toEqual({ updatedCards: 2, updatedConnections: 1 });

    await expect(
      service.updateBoardLayout(ownerContext, seedIds.board, {
        cards: [
          { id: source.id, position: { x: 999, y: 999 } },
          { id: randomUUID(), position: { x: 1, y: 1 } }
        ]
      })
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(repository.getCard(source.id)).resolves.toMatchObject({
      position: { x: 130, y: 140 }
    });
    await expect(repository.getConnection(connection.id)).resolves.toMatchObject({ visualStyle });
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
