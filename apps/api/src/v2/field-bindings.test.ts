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

function createFieldBindingServer(
  setupSeed?: (seed: ReturnType<typeof createDefaultV2MemorySeed>) => void
) {
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

describe("v2 linked field bindings API", () => {
  it("creates generic bindings for data.inn, data.phone, and title", async () => {
    const { server, seed } = createFieldBindingServer();
    const source = seed.cards[0]!;
    const target = seed.cards[1]!;

    for (const [targetField, sourceFieldPath] of [
      ["supplierInn", "data.inn"],
      ["supplierPhone", "data.phone"],
      ["assigneeName", "title"]
    ] as const) {
      const response = await server.inject({
        method: "POST",
        url: `/v2/boards/${seed.board.id}/field-bindings`,
        payload: {
          targetCardId: target.id,
          targetField,
          sourceMode: "exactCard",
          direction: "incoming",
          sourceCardId: source.id,
          sourceFieldPath
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        boardId: seed.board.id,
        targetCardId: target.id,
        targetField,
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: source.id,
        sourceFieldPath,
        status: "active"
      });
    }

    await server.close();
  });

  it("lists bindings, updates generic fields, and soft-deletes bindings", async () => {
    const { server, seed } = createFieldBindingServer();
    const source = seed.cards[0]!;
    const target = seed.cards[1]!;

    const createdResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/field-bindings`,
      payload: {
        targetCardId: target.id,
        targetField: "supplierPhone",
        sourceMode: "connectedCard",
        direction: "incoming",
        sourceCardTypeId: seed.cardTypes[0]!.id,
        sourceCardTypeKey: seed.cardTypes[0]!.key,
        sourceFieldPath: "data.phone"
      }
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json();

    const listResponse = await server.inject({
      method: "GET",
      url: `/v2/boards/${seed.board.id}/field-bindings`
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      fieldBindings: [expect.objectContaining({ id: created.id })]
    });

    const updatedResponse = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/field-bindings/${created.id}`,
      payload: {
        targetField: "supplierEmail",
        sourceFieldPath: "data.email",
        sourceCardId: source.id,
        sourceMode: "exactCard"
      }
    });
    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json()).toMatchObject({
      id: created.id,
      targetField: "supplierEmail",
      sourceFieldPath: "data.email",
      sourceMode: "exactCard",
      sourceCardId: source.id
    });

    const deleteResponse = await server.inject({
      method: "DELETE",
      url: `/v2/boards/${seed.board.id}/field-bindings/${created.id}`
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toEqual({ deleted: true, id: created.id });

    const afterDeleteResponse = await server.inject({
      method: "GET",
      url: `/v2/boards/${seed.board.id}/field-bindings`
    });
    expect(afterDeleteResponse.statusCode).toBe(200);
    expect(afterDeleteResponse.json()).toEqual({ fieldBindings: [] });

    await server.close();
  });

  it("rejects empty targetField and empty sourceFieldPath", async () => {
    const { server, seed } = createFieldBindingServer();
    const source = seed.cards[0]!;
    const target = seed.cards[1]!;

    const emptyTargetResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/field-bindings`,
      payload: {
        targetCardId: target.id,
        targetField: "",
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: source.id,
        sourceFieldPath: "data.phone"
      }
    });
    expect(emptyTargetResponse.statusCode).toBe(400);

    const emptyPathResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/field-bindings`,
      payload: {
        targetCardId: target.id,
        targetField: "supplierPhone",
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: source.id,
        sourceFieldPath: ""
      }
    });
    expect(emptyPathResponse.statusCode).toBe(400);

    await server.close();
  });

  it("rejects target and source cards from another board", async () => {
    const foreignBoardId = "12121212-1212-4212-8212-121212121212";
    const { server, seed } = createFieldBindingServer((draft) => {
      draft.cards.push({
        ...draft.cards[0]!,
        id: "34343434-3434-4434-8434-343434343434",
        boardId: foreignBoardId,
        title: "Foreign card"
      });
    });
    const source = seed.cards[0]!;
    const target = seed.cards[1]!;
    const foreignCard = seed.cards.at(-1)!;

    const foreignTargetResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/field-bindings`,
      payload: {
        targetCardId: foreignCard.id,
        targetField: "supplierPhone",
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: source.id,
        sourceFieldPath: "data.phone"
      }
    });
    expect(foreignTargetResponse.statusCode).toBe(404);

    const foreignSourceResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/field-bindings`,
      payload: {
        targetCardId: target.id,
        targetField: "supplierPhone",
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: foreignCard.id,
        sourceFieldPath: "data.phone"
      }
    });
    expect(foreignSourceResponse.statusCode).toBe(404);

    await server.close();
  });

  it("does not change card.data when creating, updating, or deleting a binding", async () => {
    const { server, seed, repository } = createFieldBindingServer();
    const source = seed.cards[0]!;
    const target = seed.cards[1]!;
    const beforeSourceData = (await repository.getCard(source.id))?.data;
    const beforeTargetData = (await repository.getCard(target.id))?.data;

    const createdResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/field-bindings`,
      payload: {
        targetCardId: target.id,
        targetField: "supplierPhone",
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: source.id,
        sourceFieldPath: "data.phone"
      }
    });
    const created = createdResponse.json();

    await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/field-bindings/${created.id}`,
      payload: {
        targetField: "supplierEmail",
        sourceFieldPath: "data.email"
      }
    });

    await server.inject({
      method: "DELETE",
      url: `/v2/boards/${seed.board.id}/field-bindings/${created.id}`
    });

    await expect(repository.getCard(source.id)).resolves.toMatchObject({ data: beforeSourceData });
    await expect(repository.getCard(target.id)).resolves.toMatchObject({ data: beforeTargetData });
    await server.close();
  });
});
