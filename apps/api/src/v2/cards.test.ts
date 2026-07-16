import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { createDefaultV2MemorySeed, createV2MemoryRepository } from "./repository.js";
import { registerV2Routes } from "./routes.js";
import { createV2BoardService } from "./service.js";
import type { RequestContext } from "../context.js";

const ownerContext: RequestContext = {
  userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  source: "dev"
};

const outsideContext: RequestContext = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  source: "dev"
};

function createCardServer(
  context: RequestContext = ownerContext,
  setupSeed?: (seed: ReturnType<typeof createDefaultV2MemorySeed>) => void
) {
  const seed = createDefaultV2MemorySeed();
  setupSeed?.(seed);
  const repository = createV2MemoryRepository(seed);
  const service = createV2BoardService(repository);
  const server = Fastify();

  server.addHook("preHandler", async (request) => {
    request.requestContext = context;
  });
  registerV2Routes(server, service);

  return { server, seed, repository };
}

describe("v2 card API", () => {
  it("updates card positions and manual connector geometry atomically", async () => {
    const { server, seed, repository } = createCardServer();
    const cards = seed.cards.slice(0, 2);
    const connection = seed.connections[0]!;
    const payload = {
      cards: cards.map((card, index) => ({
        id: card.id,
        position: { x: card.position.x + 80 + index, y: card.position.y + 40 },
        zIndex: cards.length - index
      })),
      connections: [
        {
          id: connection.id,
          visualStyle: {
            routeMode: "manual" as const,
            waypoints: [{ x: 360, y: 260 }],
            labelPosition: { x: 380, y: 240 }
          }
        }
      ]
    };

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/layout`,
      payload
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ updatedCards: 2, updatedConnections: 1 });
    const detail = await repository.getBoardDetail(seed.board.id);
    expect(detail?.cards.find((card) => card.id === cards[0]!.id)?.position).toEqual(
      payload.cards[0]!.position
    );
    expect(detail?.cards.find((card) => card.id === cards[0]!.id)?.visualStyle).toMatchObject({
      zIndex: payload.cards[0]!.zIndex
    });
    expect(detail?.connections.find((item) => item.id === connection.id)?.visualStyle).toEqual(
      payload.connections[0]!.visualStyle
    );
    await server.close();
  });

  it("rolls back the full layout batch when an item is stale", async () => {
    const { server, seed, repository } = createCardServer();
    const card = seed.cards[0]!;
    const originalPosition = { ...card.position };
    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/layout`,
      payload: {
        cards: [
          { id: card.id, position: { x: 999, y: 999 } },
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            position: { x: 1, y: 1 }
          }
        ]
      }
    });

    expect(response.statusCode).toBe(409);
    await expect(repository.getCard(card.id)).resolves.toMatchObject({ position: originalPosition });
    await server.close();
  });

  it("creates a card for an accessible board", async () => {
    const { server, seed } = createCardServer();
    const cardType = seed.cardTypes[0]!;

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: {
        cardTypeId: cardType.id,
        position: { x: 128, y: 256 }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: cardType.id,
      title: cardType.name,
      description: "",
      data: {},
      position: { x: 128, y: 256 },
      size: cardType.defaultSize,
      visualStyle: {},
      status: "active"
    });

    await server.close();
  });

  it("creates containers and persists validated card membership", async () => {
    const { server, seed, repository } = createCardServer();

    const createResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: {
        container: { variant: "frame", theme: "blue" },
        title: "Supplier group",
        position: { x: 80, y: 120 }
      }
    });
    expect(createResponse.statusCode).toBe(201);
    const container = createResponse.json();
    expect(container).toMatchObject({
      title: "Supplier group",
      containerId: null,
      size: { width: 720, height: 480 },
      visualStyle: {
        containerVariant: "frame",
        containerTheme: "blue",
        fillColor: "#e7f1ff",
        borderColor: "#78a9e6"
      }
    });

    const detailAfterCreate = await repository.getBoardDetail(seed.board.id);
    expect(detailAfterCreate?.cardTypes.find((cardType) => cardType.id === container.cardTypeId))
      .toMatchObject({
        kind: "container",
        key: "yadraw_system_container",
        ports: [
          expect.objectContaining({ key: "in", direction: "input" }),
          expect.objectContaining({ key: "out", direction: "output" })
        ]
      });

    const child = seed.cards[0]!;
    const attachResponse = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/layout`,
      payload: { cards: [{ id: child.id, containerId: container.id }] }
    });
    expect(attachResponse.statusCode).toBe(200);
    await expect(repository.getCard(child.id)).resolves.toMatchObject({
      containerId: container.id
    });

    const ordinaryParentResponse = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/layout`,
      payload: { cards: [{ id: child.id, containerId: seed.cards[1]!.id }] }
    });
    expect(ordinaryParentResponse.statusCode).toBe(400);
    await expect(repository.getCard(child.id)).resolves.toMatchObject({
      containerId: container.id
    });

    const detachResponse = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/layout`,
      payload: { cards: [{ id: child.id, containerId: null }] }
    });
    expect(detachResponse.statusCode).toBe(200);
    await expect(repository.getCard(child.id)).resolves.toMatchObject({ containerId: null });
    await server.close();
  });

  it("uses variant-specific default container colors", async () => {
    const { server, seed } = createCardServer();

    const stickyResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: { container: { variant: "sticky" } }
    });
    expect(stickyResponse.statusCode).toBe(201);
    expect(stickyResponse.json()).toMatchObject({
      visualStyle: {
        containerVariant: "sticky",
        containerTheme: "yellow",
        fillColor: "#fff7c2"
      }
    });

    const frameResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: { container: { variant: "frame" } }
    });
    expect(frameResponse.statusCode).toBe(201);
    expect(frameResponse.json()).toMatchObject({
      visualStyle: {
        containerVariant: "frame",
        containerTheme: "white",
        fillColor: "#ffffff"
      }
    });

    await server.close();
  });

  it("rejects unknown boards", async () => {
    const { server, seed } = createCardServer();

    const response = await server.inject({
      method: "POST",
      url: "/v2/boards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2/cards",
      payload: {
        cardTypeId: seed.cardTypes[0]!.id
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "not_found" } });
    await server.close();
  });

  it("rejects unknown card types", async () => {
    const { server, seed } = createCardServer();

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: {
        cardTypeId: "99999999-9999-4999-8999-999999999999"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "not_found" } });
    await server.close();
  });

  it("rejects inaccessible boards", async () => {
    const { server, seed } = createCardServer(outsideContext);

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: {
        cardTypeId: seed.cardTypes[0]!.id
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "forbidden" } });
    await server.close();
  });

  it("duplicates a card without copying connections or attachments", async () => {
    const { server, seed, repository } = createCardServer(ownerContext, (draft) => {
      draft.cards[0] = {
        ...draft.cards[0]!,
        title: "Original card",
        description: "Original description",
        data: {
          nested: {
            value: true
          },
          count: 3
        },
        position: { x: 120, y: 160 },
        size: { width: 240, height: 150 },
        visualStyle: {
          fontWeight: "700",
          textAlign: "center"
        }
      };
    });
    const source = seed.cards[0]!;
    const originalConnectionCount = seed.connections.length;

    await repository.createCardAttachment?.({
      fileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      cardId: source.id,
      workspaceId: source.workspaceId,
      storageBucket: "test-bucket",
      storagePath: "test/path.txt",
      filename: "original.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      sha256: null,
      role: "attachment",
      metadata: {},
      createdBy: ownerContext.userId
    });

    const response = await server.inject({
      method: "POST",
      url: `/v2/cards/${source.id}/duplicate`
    });

    expect(response.statusCode).toBe(201);
    const duplicated = response.json();
    expect(duplicated.id).not.toBe(source.id);
    expect(duplicated).toMatchObject({
      workspaceId: source.workspaceId,
      boardId: source.boardId,
      cardTypeId: source.cardTypeId,
      title: source.title,
      description: source.description,
      data: source.data,
      size: source.size,
      visualStyle: source.visualStyle,
      position: {
        x: source.position.x + 40,
        y: source.position.y + 40
      },
      status: "active"
    });

    const originalAfter = await repository.getCard(source.id);
    expect(originalAfter).toMatchObject(source);

    const board = await repository.getBoardDetail(seed.board.id);
    expect(board?.connections).toHaveLength(originalConnectionCount);
    expect(board?.connections.some((connection) =>
      connection.sourceCardId === duplicated.id ||
      connection.targetCardId === duplicated.id
    )).toBe(false);

    await expect(repository.listCardAttachments?.(source.id)).resolves.toHaveLength(1);
    await expect(repository.listCardAttachments?.(duplicated.id)).resolves.toEqual([]);
    await server.close();
  });

  it("rejects missing duplicate source cards", async () => {
    const { server } = createCardServer();

    const response = await server.inject({
      method: "POST",
      url: "/v2/cards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2/duplicate"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "not_found" } });
    await server.close();
  });

  it("rejects deleted duplicate source cards", async () => {
    const { server, seed } = createCardServer();
    const source = seed.cards[0]!;

    const deleteResponse = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${source.id}`
    });
    expect(deleteResponse.statusCode).toBe(200);

    const duplicateResponse = await server.inject({
      method: "POST",
      url: `/v2/cards/${source.id}/duplicate`
    });

    expect(duplicateResponse.statusCode).toBe(404);
    expect(duplicateResponse.json()).toMatchObject({ error: { code: "not_found" } });
    await server.close();
  });

  it("rejects inaccessible duplicate source cards", async () => {
    const { server, seed } = createCardServer(outsideContext);

    const response = await server.inject({
      method: "POST",
      url: `/v2/cards/${seed.cards[0]!.id}/duplicate`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "forbidden" } });
    await server.close();
  });

  it("creates connections through visual connector slots", async () => {
    const { server, seed, repository } = createCardServer();
    const sourceType = seed.cardTypes.find((cardType) => cardType.key === "source")!;
    const taskType = seed.cardTypes.find((cardType) => cardType.key === "task")!;
    const source = await repository.createCard({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: sourceType.id,
      title: "Visual slot source",
      description: "",
      data: { business: "source" },
      position: { x: 400, y: 260 },
      size: sourceType.defaultSize,
      status: "active",
      visualStyle: {
        connectorSlots: [
          {
            id: "slot-output-1",
            type: "output",
            side: "right",
            offset: 0.5
          }
        ]
      }
    });
    const target = await repository.createCard({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: taskType.id,
      title: "Visual slot target",
      description: "",
      data: { business: "target" },
      position: { x: 680, y: 260 },
      size: taskType.defaultSize,
      status: "active",
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

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/connections`,
      payload: {
        sourceCardId: source.id,
        targetCardId: target.id,
        sourcePortKey: "slot-output-1",
        targetPortKey: "slot-input-1"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      sourceCardId: source.id,
      targetCardId: target.id,
      sourcePortKey: "slot-output-1",
      targetPortKey: "slot-input-1"
    });

    const detail = await repository.getBoardDetail(seed.board.id);
    expect(detail?.connections.map((connection) => connection.id)).toContain(response.json().id);
    expect(detail?.cards.find((card) => card.id === source.id)?.data).toEqual({ business: "source" });
    expect(detail?.cards.find((card) => card.id === target.id)?.data).toEqual({ business: "target" });

    await server.close();
  });

  it("updates connector metadata through the API", async () => {
    const { server, seed, repository } = createCardServer();
    const source = seed.cards[0]!;
    const target = seed.cards[1]!;
    const connection = await repository.createConnection({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      sourceCardId: source.id,
      targetCardId: target.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      type: "data",
      label: "payload",
      status: "active"
    });

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/connections/${connection.id}`,
      payload: {
        title: "Reviewed payload",
        description: "Transfers reviewed data",
        data: {
          payload: "json",
          reviewed: true
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: connection.id,
      title: "Reviewed payload",
      description: "Transfers reviewed data",
      data: {
        payload: "json",
        reviewed: true
      },
      sourceCardId: source.id,
      targetCardId: target.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    const board = await repository.getBoardDetail(seed.board.id);
    expect(board?.connections.find((item) => item.id === connection.id)).toMatchObject({
      title: "Reviewed payload",
      description: "Transfers reviewed data",
      data: {
        payload: "json",
        reviewed: true
      }
    });
    expect(board?.cards.find((card) => card.id === source.id)?.data).toEqual(source.data);

    await server.close();
  });

  it("rejects invalid connector metadata through the API", async () => {
    const { server, seed, repository } = createCardServer();
    const connection = seed.connections[0]!;

    const invalidDataResponse = await server.inject({
      method: "PATCH",
      url: `/v2/connections/${connection.id}`,
      payload: {
        data: ["not", "object"]
      }
    });
    expect(invalidDataResponse.statusCode).toBe(400);
    expect(invalidDataResponse.json()).toMatchObject({ error: { code: "invalid_payload" } });

    await repository.deleteConnection(connection.id);
    const deletedResponse = await server.inject({
      method: "PATCH",
      url: `/v2/connections/${connection.id}`,
      payload: {
        title: "Deleted"
      }
    });
    expect(deletedResponse.statusCode).toBe(404);

    await server.close();
  });

  it("soft-deletes a card and hides its incident connections from board detail", async () => {
    const { server, seed, repository } = createCardServer();
    const source = seed.cards[0]!;
    const originalConnection = seed.connections[0]!;
    const sourceType = seed.cardTypes.find((cardType) => cardType.key === "source")!;
    const taskType = seed.cardTypes.find((cardType) => cardType.key === "task")!;
    const unrelatedSource = await repository.createCard({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: sourceType.id,
      title: "Unrelated source",
      description: "",
      data: {},
      position: { x: 400, y: 100 },
      size: sourceType.defaultSize,
      status: "active",
      visualStyle: {}
    });
    const unrelatedTarget = await repository.createCard({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      cardTypeId: taskType.id,
      title: "Unrelated target",
      description: "",
      data: {},
      position: { x: 640, y: 100 },
      size: taskType.defaultSize,
      status: "active",
      visualStyle: {}
    });
    const unrelatedConnection = await repository.createConnection({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      sourceCardId: unrelatedSource.id,
      targetCardId: unrelatedTarget.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      type: "data",
      label: "payload",
      status: "active"
    });

    const response = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${source.id}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ deleted: true, id: source.id });
    await expect(repository.getCard(source.id)).resolves.toBeNull();

    const board = await repository.getBoardDetail(seed.board.id);
    expect(board?.cards.some((card) => card.id === source.id)).toBe(false);
    expect(board?.connections.map((connection) => connection.id)).not.toContain(originalConnection.id);
    expect(board?.connections.map((connection) => connection.id)).toContain(unrelatedConnection.id);
    await expect(repository.getConnection(originalConnection.id)).resolves.toBeNull();

    await server.close();
  });

  it("rejects missing card deletes", async () => {
    const { server } = createCardServer();

    const response = await server.inject({
      method: "DELETE",
      url: "/v2/cards/b4f94635-6fd5-4a6b-8608-61a69c81fbe2"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "not_found" } });
    await server.close();
  });

  it("rejects already deleted card deletes", async () => {
    const { server, seed } = createCardServer();
    const source = seed.cards[0]!;

    const firstResponse = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${source.id}`
    });
    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${source.id}`
    });

    expect(secondResponse.statusCode).toBe(404);
    expect(secondResponse.json()).toMatchObject({ error: { code: "not_found" } });
    await server.close();
  });

  it("rejects inaccessible card deletes", async () => {
    const { server, seed } = createCardServer(outsideContext);

    const response = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${seed.cards[0]!.id}`
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "forbidden" } });
    await server.close();
  });

  it("keeps attachment file and card-file records when deleting a card", async () => {
    const { server, seed, repository } = createCardServer();
    const source = seed.cards[0]!;
    const fileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const attachment = await repository.createCardAttachment?.({
      fileId,
      cardId: source.id,
      workspaceId: source.workspaceId,
      storageBucket: "test-bucket",
      storagePath: "test/path.txt",
      filename: "original.txt",
      mimeType: "text/plain",
      sizeBytes: 12,
      sha256: null,
      role: "attachment",
      metadata: {},
      createdBy: ownerContext.userId
    });

    const response = await server.inject({
      method: "DELETE",
      url: `/v2/cards/${source.id}`
    });

    expect(response.statusCode).toBe(200);
    await expect(repository.getFileForDownload?.(fileId)).resolves.toMatchObject({
      fileId,
      filename: "original.txt"
    });
    await expect(repository.detachCardAttachment?.(source.id, attachment!.id)).resolves.toBe(true);

    await server.close();
  });
});
