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

function createCardServer(context: RequestContext = ownerContext) {
  const seed = createDefaultV2MemorySeed();
  const repository = createV2MemoryRepository(seed);
  const service = createV2BoardService(repository);
  const server = Fastify();

  server.addHook("preHandler", async (request) => {
    request.requestContext = context;
  });
  registerV2Routes(server, service);

  return { server, seed };
}

describe("v2 card API", () => {
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
});
