import { describe, expect, it } from "vitest";
import { createDefaultV2MemorySeed, createV2MemoryRepository } from "./repository.js";
import { createV2BoardService, V2ServiceError } from "./service.js";

function getSeedParts() {
  const seed = createDefaultV2MemorySeed();
  const sourceType = seed.cardTypes.find((cardType) => cardType.key === "source");
  const taskType = seed.cardTypes.find((cardType) => cardType.key === "task");

  if (!sourceType || !taskType) {
    throw new Error("Invalid v2 memory seed");
  }

  return { seed, sourceType, taskType };
}

describe("v2 board service", () => {
  it("creates cards from card type defaults", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    const card = await service.createCard(seed.board.id, {
      cardTypeId: sourceType.id
    });

    expect(card).toMatchObject({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: sourceType.id,
      title: "Source",
      description: "",
      data: sourceType.defaultData,
      size: sourceType.defaultSize,
      status: "draft"
    });

    await expect(service.getBoard(seed.board.id)).resolves.toMatchObject({
      cards: [expect.objectContaining({ id: card.id })]
    });
  });

  it("updates card fields through validated request payloads", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const card = await service.createCard(seed.board.id, {
      cardTypeId: sourceType.id
    });

    await expect(
      service.updateCard(card.id, {
        title: "Webhook",
        data: { endpoint: "/hook" },
        position: { x: 128, y: 256 }
      })
    ).resolves.toMatchObject({
      id: card.id,
      title: "Webhook",
      data: { endpoint: "/hook" },
      position: { x: 128, y: 256 }
    });
  });

  it("creates typed connections only through valid output and input ports", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(seed.board.id, {
      cardTypeId: sourceType.id,
      title: "Webhook"
    });
    const task = await service.createCard(seed.board.id, {
      cardTypeId: taskType.id,
      title: "Transform"
    });

    const connection = await service.createConnection(seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    expect(connection).toMatchObject({
      boardId: seed.board.id,
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      type: "data",
      status: "active"
    });
  });

  it("rejects invalid ports and duplicate connections", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(seed.board.id, { cardTypeId: taskType.id });

    await expect(
      service.createConnection(seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "missing",
        targetPortKey: "input"
      })
    ).rejects.toMatchObject({
      code: "validation_failed"
    });

    await service.createConnection(seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await expect(
      service.createConnection(seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).rejects.toBeInstanceOf(V2ServiceError);
    await expect(
      service.createConnection(seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).rejects.toMatchObject({
      code: "conflict"
    });
  });

  it("soft-deletes cards and removes their active connections from the board detail", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(seed.board.id, { cardTypeId: taskType.id });

    await service.createConnection(seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await expect(service.deleteCard(source.id)).resolves.toEqual({
      deleted: true,
      id: source.id
    });

    await expect(service.getBoard(seed.board.id)).resolves.toMatchObject({
      cards: [expect.objectContaining({ id: task.id })],
      connections: []
    });
  });
});

