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

function createSchemaServer(setupSeed?: (seed: ReturnType<typeof createDefaultV2MemorySeed>) => void) {
  const seed = createDefaultV2MemorySeed();
  setupSeed?.(seed);
  const repository = createV2MemoryRepository(seed);
  const service = createV2BoardService(repository);
  const server = Fastify();

  server.addHook("preHandler", async (request) => {
    request.requestContext = ownerContext;
  });
  registerV2Routes(server, service);

  return { server, seed, repository };
}

describe("v2 card type schema API", () => {
  it("updates card type schema with valid fields", async () => {
    const { server, seed } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}/schema`,
      payload: {
        schema: {
          fields: [
            { key: "name", label: "Name", type: "text", required: true },
            { key: "rating", label: "Rating", type: "number" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: [
                { value: "new", label: "New" },
                { value: "done", label: "Done" }
              ]
            }
          ]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: cardType.id,
      schema: {
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "rating", label: "Rating", type: "number" },
          { key: "status", label: "Status", type: "select" }
        ]
      }
    });

    await server.close();
  });

  it("rejects invalid schema field payloads", async () => {
    const { server, seed } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;

    for (const payload of [
      { schema: { fields: [{ key: "name", label: "Name", type: "formula" }] } },
      { schema: { fields: [{ key: "", label: "Name", type: "text" }] } },
      {
        schema: {
          fields: [
            { key: "name", label: "Name", type: "text" },
            { key: "name", label: "Duplicate", type: "number" }
          ]
        }
      }
    ]) {
      const response = await server.inject({
        method: "PATCH",
        url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}/schema`,
        payload
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "invalid_payload" } });
    }

    await server.close();
  });

  it("does not modify default data, card data, ports, or linked fields", async () => {
    const { server, seed, repository } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;
    const card = seed.cards.find((item) => item.cardTypeId === cardType.id)!;
    const defaultData = structuredClone(cardType.defaultData);
    const cardData = structuredClone(card.data);
    const ports = structuredClone(cardType.ports);

    await repository.createLinkedFieldBinding?.({
      workspaceId: seed.workspace.id,
      boardId: seed.board.id,
      targetCardId: card.id,
      targetField: "linkedValue",
      sourceMode: "connectedCard",
      direction: "incoming",
      sourceCardId: null,
      sourceCardTypeId: null,
      sourceCardTypeKey: null,
      sourceFieldPath: "title",
      onMissing: "empty",
      onMultiple: "warning",
      status: "active"
    });

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}/schema`,
      payload: {
        schema: {
          fields: [{ key: "phone", label: "Phone", type: "text" }]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const detail = await repository.getBoardDetail(seed.board.id);
    const updatedType = detail!.cardTypes.find((item) => item.id === cardType.id)!;
    const updatedCard = detail!.cards.find((item) => item.id === card.id)!;
    const bindings = await repository.listLinkedFieldBindings?.(seed.board.id);

    expect(updatedType.defaultData).toEqual(defaultData);
    expect(updatedType.ports).toEqual(ports);
    expect(updatedCard.data).toEqual(cardData);
    expect(bindings).toHaveLength(1);

    await server.close();
  });

  it("returns updated schema in board detail", async () => {
    const { server, seed, repository } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;

    await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}/schema`,
      payload: {
        schema: {
          fields: [{ key: "email", label: "Email", type: "text" }]
        }
      }
    });

    await expect(repository.getBoardDetail(seed.board.id)).resolves.toMatchObject({
      cardTypes: expect.arrayContaining([
        expect.objectContaining({
          id: cardType.id,
          schema: { fields: [{ key: "email", label: "Email", type: "text" }] }
        })
      ])
    });

    await server.close();
  });

  it("rejects soft-deleted card types", async () => {
    const { server, seed } = createSchemaServer((draft) => {
      draft.deletedCardTypeIds = [draft.cardTypes[0]!.id];
    });
    const cardType = seed.cardTypes[0]!;

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}/schema`,
      payload: {
        schema: {
          fields: [{ key: "name", label: "Name", type: "text" }]
        }
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "not_found" } });

    await server.close();
  });
});
