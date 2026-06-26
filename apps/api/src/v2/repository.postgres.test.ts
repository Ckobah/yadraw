import { describe, expect, it } from "vitest";
import { createV2PostgresRepository } from "./repository.js";
import { createV2BoardService } from "./service.js";

const v2DatabaseUrl = process.env.V2_DATABASE_URL;
const describeIfPostgres = v2DatabaseUrl ? describe : describe.skip;

const seedIds = {
  workspace: "11111111-1111-4111-8111-111111111111",
  board: "33333333-3333-4333-8333-333333333333",
  sourceType: "44444444-4444-4444-8444-444444444444",
  taskType: "55555555-5555-4555-8555-555555555555"
} as const;

describeIfPostgres("v2 Postgres repository", () => {
  it("persists the core board workflow", async () => {
    const repository = createV2PostgresRepository(v2DatabaseUrl as string);
    const service = createV2BoardService(repository);

    const initialBoard = await service.getBoard(seedIds.board);
    expect(initialBoard).toMatchObject({
      workspace: { id: seedIds.workspace },
      board: { id: seedIds.board },
      cardTypes: expect.arrayContaining([
        expect.objectContaining({ id: seedIds.sourceType, key: "source" }),
        expect.objectContaining({ id: seedIds.taskType, key: "task" })
      ])
    });

    const source = await service.createCard(seedIds.board, {
      cardTypeId: seedIds.sourceType,
      title: `Source ${Date.now()}`,
      data: { endpoint: "/hook" },
      position: { x: 120, y: 160 }
    });
    const task = await service.createCard(seedIds.board, {
      cardTypeId: seedIds.taskType,
      title: `Task ${Date.now()}`,
      data: { operation: "normalize" },
      position: { x: 480, y: 160 }
    });

    const connection = await service.createConnection(seedIds.board, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      label: "payload"
    });

    await expect(
      service.updateCard(task.id, {
        data: { operation: "normalize", reviewed: true }
      })
    ).resolves.toMatchObject({
      id: task.id,
      data: { operation: "normalize", reviewed: true }
    });

    await expect(service.getBoard(seedIds.board)).resolves.toMatchObject({
      cards: expect.arrayContaining([
        expect.objectContaining({ id: source.id }),
        expect.objectContaining({ id: task.id, data: { operation: "normalize", reviewed: true } })
      ]),
      connections: expect.arrayContaining([expect.objectContaining({ id: connection.id })])
    });

    await expect(service.deleteCard(source.id)).resolves.toEqual({
      deleted: true,
      id: source.id
    });

    const afterDelete = await service.getBoard(seedIds.board);
    expect(afterDelete.cards.map((card) => card.id)).not.toContain(source.id);
    expect(afterDelete.connections.map((item) => item.id)).not.toContain(connection.id);

    await service.deleteCard(task.id);
  });
});

