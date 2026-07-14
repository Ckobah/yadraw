import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { RequestContext } from "../context.js";
import { createDefaultV2MemorySeed, createV2MemoryRepository } from "./repository.js";
import { registerV2Routes } from "./routes.js";
import { createV2BoardService } from "./service.js";

const ownerContext: RequestContext = {
  userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  source: "dev"
};

function createCardLibraryServer() {
  const seed = createDefaultV2MemorySeed();
  const sourceType = seed.cardTypes.find((cardType) => cardType.key === "source");
  if (!sourceType) throw new Error("Source type is missing from the v2 seed");
  sourceType.schema = {
    fields: [
      { key: "supplierCode", label: "Supplier code", type: "text", required: true }
    ]
  };

  const repository = createV2MemoryRepository(seed);
  const server = Fastify();
  server.addHook("preHandler", async (request) => {
    request.requestContext = ownerContext;
  });
  registerV2Routes(server, createV2BoardService(repository));
  return { server, seed, sourceType };
}

describe("v2 card library API", () => {
  it("creates, lists, links, live-updates, and unlinks a library entry", async () => {
    const { server, seed, sourceType } = createCardLibraryServer();
    const createdResponse = await server.inject({
      method: "POST",
      url: `/v2/workspaces/${seed.workspace.id}/card-types/${sourceType.id}/library-entries`,
      payload: {
        title: "Northwind",
        data: { supplierCode: "NW" }
      }
    });
    expect(createdResponse.statusCode).toBe(201);
    const entry = createdResponse.json();
    expect(entry).toMatchObject({ title: "Northwind", version: 1, selectable: true });

    const listResponse = await server.inject({
      method: "GET",
      url: `/v2/workspaces/${seed.workspace.id}/card-types/${sourceType.id}/library-entries?query=north&limit=10`
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      entries: [expect.objectContaining({ id: entry.id, usageCount: 0 })],
      nextCursor: null
    });

    const cardResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: {
        cardTypeId: sourceType.id,
        libraryEntryId: entry.id,
        position: { x: 80, y: 160 }
      }
    });
    expect(cardResponse.statusCode).toBe(201);
    const card = cardResponse.json();
    expect(card).toMatchObject({
      libraryEntryId: entry.id,
      title: "Northwind",
      data: { supplierCode: "NW" }
    });

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/v2/workspaces/${seed.workspace.id}/card-types/${sourceType.id}/library-entries/${entry.id}`,
      payload: {
        title: "Northwind Ltd",
        data: { supplierCode: "NWL" },
        expectedVersion: 1
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({ version: 2, usageCount: 1 });

    const boardResponse = await server.inject({
      method: "GET",
      url: `/v2/boards/${seed.board.id}`
    });
    expect(boardResponse.statusCode).toBe(200);
    expect(boardResponse.json()).toMatchObject({
      cards: expect.arrayContaining([
        expect.objectContaining({
          id: card.id,
          title: "Northwind Ltd",
          data: { supplierCode: "NWL" }
        })
      ])
    });

    const unlinkResponse = await server.inject({
      method: "PATCH",
      url: `/v2/cards/${card.id}/library-entry`,
      payload: { libraryEntryId: null, expectedLibraryEntryId: entry.id }
    });
    expect(unlinkResponse.statusCode).toBe(200);
    expect(unlinkResponse.json()).toMatchObject({
      id: card.id,
      libraryEntryId: null,
      title: "Northwind Ltd",
      data: { supplierCode: "NWL" }
    });
    await server.close();
  });

  it("keeps incomplete rows unselectable and reports optimistic conflicts", async () => {
    const { server, seed, sourceType } = createCardLibraryServer();
    const created = await server.inject({
      method: "POST",
      url: `/v2/workspaces/${seed.workspace.id}/card-types/${sourceType.id}/library-entries`,
      payload: { title: "Incomplete supplier" }
    });
    expect(created.statusCode).toBe(201);
    const entry = created.json();
    expect(entry).toMatchObject({ selectable: false });

    const bind = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: { cardTypeId: sourceType.id, libraryEntryId: entry.id }
    });
    expect(bind.statusCode).toBe(400);

    const staleUpdate = await server.inject({
      method: "PATCH",
      url: `/v2/workspaces/${seed.workspace.id}/card-types/${sourceType.id}/library-entries/${entry.id}`,
      payload: {
        data: { supplierCode: "OK" },
        expectedVersion: 99
      }
    });
    expect(staleUpdate.statusCode).toBe(409);
    await server.close();
  });
});
