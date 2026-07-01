import { describe, expect, it } from "vitest";
import { createDefaultV2MemorySeed, createV2MemoryRepository } from "./repository.js";
import { createV2BoardService, V2ServiceError } from "./service.js";

const ownerContext = {
  userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  source: "dev" as const
};
const viewerContext = {
  userId: "9f18a762-53e5-4922-9b0b-8f168921bb0f",
  source: "dev" as const
};

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
  it("creates cards from minimal canvas input", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    const card = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id
    });

    expect(card).toMatchObject({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: sourceType.id,
      title: "Source",
      description: "",
      data: {},
      size: sourceType.defaultSize,
      position: { x: 0, y: 0 },
      visualStyle: {},
      status: "active"
    });

    await expect(service.getBoard(ownerContext, seed.board.id)).resolves.toMatchObject({
      cards: expect.arrayContaining([expect.objectContaining({ id: card.id })])
    });
  });

  it("creates cards with explicit data, size, and position", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    const card = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      data: { custom: true },
      position: { x: 144, y: 288 },
      size: { width: 240, height: 150 }
    });

    expect(card).toMatchObject({
      data: { custom: true },
      position: { x: 144, y: 288 },
      size: { width: 240, height: 150 },
      visualStyle: {}
    });
  });

  it("rejects create card for unknown boards", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    await expect(
      service.createCard(ownerContext, "b4f94635-6fd5-4a6b-8608-61a69c81fbe2", {
        cardTypeId: sourceType.id
      })
    ).rejects.toMatchObject({
      code: "not_found"
    });
  });

  it("rejects create card for unknown card types", async () => {
    const { seed } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    await expect(
      service.createCard(ownerContext, seed.board.id, {
        cardTypeId: "99999999-9999-4999-8999-999999999999"
      })
    ).rejects.toMatchObject({
      code: "not_found"
    });
  });

  it("updates card fields through validated request payloads", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const card = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id
    });

    await expect(
      service.updateCard(ownerContext, card.id, {
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

  it("preserves visual style when creating a card", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    const card = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      title: "Styled source",
      visualStyle: {
        textAlign: "center",
        fontWeight: "700"
      }
    });

    expect(card.visualStyle).toEqual({
      textAlign: "center",
      fontWeight: "700"
    });
  });

  it("allows viewers to read board data but rejects write operations", async () => {
    const { seed, sourceType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    await expect(service.getBoard(viewerContext, seed.board.id)).resolves.toMatchObject({
      board: { id: seed.board.id }
    });
    await expect(service.listCardTypes(viewerContext, seed.workspace.id)).resolves.toMatchObject({
      cardTypes: expect.arrayContaining([expect.objectContaining({ id: sourceType.id })])
    });
    await expect(
      service.createCard(viewerContext, seed.board.id, {
        cardTypeId: sourceType.id
      })
    ).rejects.toMatchObject({
      code: "forbidden"
    });
  });

  it("returns not_found for missing boards before authorization decisions", async () => {
    const { seed } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    await expect(
      service.getBoard(ownerContext, "b4f94635-6fd5-4a6b-8608-61a69c81fbe2")
    ).rejects.toMatchObject({
      code: "not_found"
    });
  });

  it("creates typed connections only through valid output and input ports", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      title: "Webhook"
    });
    const task = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      title: "Transform"
    });

    const connection = await service.createConnection(ownerContext, seed.board.id, {
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

  it("creates connections through persisted visual connector slots", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      data: { business: "source" },
      visualStyle: {
        connectorSlots: [
          {
            id: "slot-output-1",
            type: "output",
            side: "right",
            offset: 0.5,
            label: "Visual output"
          }
        ]
      }
    });
    const task = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      data: { business: "target" },
      visualStyle: {
        connectorSlots: [
          {
            id: "slot-input-1",
            type: "input",
            side: "left",
            offset: 0.5,
            label: "Visual input"
          }
        ]
      }
    });

    const visualToVisual = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "slot-output-1",
      targetPortKey: "slot-input-1"
    });
    const semanticToVisual = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "slot-input-1",
      label: "semantic-to-visual"
    });

    expect(visualToVisual).toMatchObject({
      sourcePortKey: "slot-output-1",
      targetPortKey: "slot-input-1"
    });
    expect(semanticToVisual).toMatchObject({
      sourcePortKey: "payload",
      targetPortKey: "slot-input-1"
    });

    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.connections.map((item) => item.id)).toEqual(
      expect.arrayContaining([visualToVisual.id, semanticToVisual.id])
    );
    expect(detail.cards.find((card) => card.id === source.id)?.data).toEqual({ business: "source" });
    expect(detail.cards.find((card) => card.id === task.id)?.data).toEqual({ business: "target" });
  });

  it("updates connection metadata without changing endpoints or card data", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const source = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      data: { sourceBusiness: true }
    });
    const task = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      data: { targetBusiness: true }
    });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    const titled = await service.updateConnection(ownerContext, connection.id, {
      title: "Normalized payload",
      data: { payload: "json", priority: 2 }
    });
    expect(titled).toMatchObject({
      id: connection.id,
      title: "Normalized payload",
      description: null,
      data: { payload: "json", priority: 2 },
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    const described = await service.updateConnection(ownerContext, connection.id, {
      description: "Transfers only reviewed records"
    });
    expect(described).toMatchObject({
      title: "Normalized payload",
      description: "Transfers only reviewed records",
      data: { payload: "json", priority: 2 }
    });

    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.connections.find((item) => item.id === connection.id)).toMatchObject({
      title: "Normalized payload",
      description: "Transfers only reviewed records",
      data: { payload: "json", priority: 2 }
    });
    expect(detail.cards.find((card) => card.id === source.id)?.data).toEqual({ sourceBusiness: true });
    expect(detail.cards.find((card) => card.id === task.id)?.data).toEqual({ targetBusiness: true });
  });

  it("updates connection visual style without changing connection or card data", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const source = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      data: { sourceBusiness: true }
    });
    const task = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      data: { targetBusiness: true }
    });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    const styled = await service.updateConnection(ownerContext, connection.id, {
      visualStyle: {
        strokeColor: "#2563eb",
        strokeWidth: 3,
        markerEnd: "arrow"
      }
    });
    expect(styled).toMatchObject({
      id: connection.id,
      data: {},
      visualStyle: {
        strokeColor: "#2563eb",
        strokeWidth: 3,
        markerEnd: "arrow"
      }
    });

    const partiallyStyled = await service.updateConnection(ownerContext, connection.id, {
      visualStyle: {
        cornerRadius: 12,
        routeMode: "manual",
        waypoints: [
          { x: 320, y: 220 },
          { x: 380, y: 260 }
        ]
      }
    });
    expect(partiallyStyled.visualStyle).toEqual({
      strokeColor: "#2563eb",
      strokeWidth: 3,
      markerEnd: "arrow",
      cornerRadius: 12,
      routeMode: "manual",
      waypoints: [
        { x: 320, y: 220 },
        { x: 380, y: 260 }
      ]
    });

    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.connections.find((item) => item.id === connection.id)).toMatchObject({
      data: {},
      visualStyle: {
        strokeColor: "#2563eb",
        strokeWidth: 3,
        cornerRadius: 12,
        markerEnd: "arrow",
        routeMode: "manual",
        waypoints: [
          { x: 320, y: 220 },
          { x: 380, y: 260 }
        ]
      }
    });
    expect(detail.cards.find((card) => card.id === source.id)?.data).toEqual({ sourceBusiness: true });
    expect(detail.cards.find((card) => card.id === task.id)?.data).toEqual({ targetBusiness: true });
  });

  it("rejects invalid or inaccessible connection metadata updates", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await expect(
      service.updateConnection(ownerContext, connection.id, {
        data: ["not", "object"] as unknown as Record<string, unknown>
      })
    ).rejects.toThrow();

    await expect(
      service.updateConnection(ownerContext, "b4f94635-6fd5-4a6b-8608-61a69c81fbe2", {
        title: "Missing"
      })
    ).rejects.toMatchObject({ code: "not_found" });

    await expect(
      service.updateConnection(viewerContext, connection.id, {
        title: "Viewer edit"
      })
    ).rejects.toMatchObject({ code: "forbidden" });

    await service.deleteConnection(ownerContext, connection.id);
    await expect(
      service.updateConnection(ownerContext, connection.id, {
        title: "Deleted edit"
      })
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects invalid ports and duplicate connections", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });

    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "missing",
        targetPortKey: "input"
      })
    ).rejects.toMatchObject({
      code: "validation_failed"
    });

    const visualTarget = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      visualStyle: {
        connectorSlots: [
          {
            id: "slot-input-1",
            type: "input",
            side: "left",
            offset: 0.5
          }
        ]
      }
    });

    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        sourceCardId: source.id,
        targetCardId: visualTarget.id,
        sourcePortKey: "payload",
        targetPortKey: "missing-visual-slot"
      })
    ).rejects.toMatchObject({
      code: "validation_failed"
    });

    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).rejects.toBeInstanceOf(V2ServiceError);
    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).rejects.toMatchObject({
      code: "conflict"
    });
  });

  it("filters orphan connections whose source/target cards do not exist in the board detail", async () => {
    const seed = createDefaultV2MemorySeed();
    const { sourceType } = getSeedParts();

    const cardA = {
      id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: sourceType.id,
      title: "Card A",
      description: "",
      data: {},
      position: { x: 0, y: 0 },
      size: { width: 280, height: 160 },
      status: "active" as const,
      visualStyle: {} as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    const orphanConnection = {
      id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      sourceCardId: cardA.id,
      targetCardId: "missing-card-id",
      sourcePortKey: "payload",
      targetPortKey: "input",
      title: null,
      description: null,
      data: {},
      visualStyle: {},
      type: "data" as const,
      label: "orphan",
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    seed.cards = [cardA];
    seed.connections = [orphanConnection];

    const repository = createV2MemoryRepository(seed);
    const detail = await repository.getBoardDetail(seed.board.id);

    expect(detail).not.toBeNull();
    const boardDetail = detail!;
    expect(boardDetail.cards).toHaveLength(1);
    expect(boardDetail.cards[0]!.id).toBe(cardA.id);
    // orphan connection should be filtered out — target card doesn't exist
    expect(boardDetail.connections).toHaveLength(0);
  });

  it("filters orphan connections where both source and target are missing", async () => {
    const seed = createDefaultV2MemorySeed();

    const orphanConnection = {
      id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      sourceCardId: "missing-source",
      targetCardId: "missing-target",
      sourcePortKey: "payload",
      targetPortKey: "input",
      title: null,
      description: null,
      data: {},
      visualStyle: {},
      type: "data" as const,
      label: "double-orphan",
      status: "active" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    seed.cards = [];
    seed.connections = [orphanConnection];

    const repository = createV2MemoryRepository(seed);
    const detail = await repository.getBoardDetail(seed.board.id);

    expect(detail).not.toBeNull();
    expect(detail!.cards).toHaveLength(0);
    // both cards missing — connection filtered out
    expect(detail!.connections).toHaveLength(0);
  });

  it("soft-deletes cards and removes their active connections from the board detail", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });

    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await expect(service.deleteCard(ownerContext, source.id)).resolves.toEqual({
      deleted: true,
      id: source.id
    });

    const board = await service.getBoard(ownerContext, seed.board.id);
    expect(board.cards).toEqual(expect.arrayContaining([expect.objectContaining({ id: task.id })]));
    expect(board.connections.map((item) => item.id)).not.toContain(connection.id);
    await expect(repository.getConnection(connection.id)).resolves.toBeNull();
  });
});

