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

  it("creates a card type with default ports and schema fields", async () => {
    const { server, seed, repository } = createSchemaServer();

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/card-types`,
      payload: {
        key: "supplier",
        name: "Supplier",
        description: "Provides material data.",
        defaultSize: { width: 260, height: 150 },
        defaultVisualStyle: {
          accentColor: "#2383ff",
          iconKey: "truck"
        },
        schema: {
          fields: [{ key: "phone", label: "Phone", type: "text" }]
        }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      key: "supplier",
      name: "Supplier",
      description: "Provides material data.",
      defaultData: {},
      defaultSize: { width: 260, height: 150 },
      defaultVisualStyle: {
        accentColor: "#2383ff",
        iconKey: "truck"
      },
      ports: [
        { key: "input", label: "Input", direction: "input" },
        { key: "output", label: "Output", direction: "output" }
      ],
      schema: { fields: [{ key: "phone", label: "Phone", type: "text" }] }
    });

    await expect(repository.getBoardDetail(seed.board.id)).resolves.toMatchObject({
      cardTypes: expect.arrayContaining([
        expect.objectContaining({ key: "supplier", name: "Supplier" })
      ])
    });

    await server.close();
  });

  it("rejects duplicate card type key and empty create fields", async () => {
    const { server, seed } = createSchemaServer();
    const existing = seed.cardTypes[0]!;

    const duplicate = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/card-types`,
      payload: {
        key: existing.key,
        name: "Duplicate",
        schema: { fields: [] }
      }
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: "conflict" } });

    for (const payload of [
      { key: "", name: "Missing key", schema: { fields: [] } },
      { key: "new_type", name: "", schema: { fields: [] } }
    ]) {
      const response = await server.inject({
        method: "POST",
        url: `/v2/boards/${seed.board.id}/card-types`,
        payload
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "invalid_payload" } });
    }

    await server.close();
  });

  it("updates card type details and schema without mutating cards or defaults", async () => {
    const { server, seed, repository } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;
    const card = seed.cards.find((item) => item.cardTypeId === cardType.id)!;
    const defaultData = structuredClone(cardType.defaultData);
    const cardData = structuredClone(card.data);

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}`,
      payload: {
        key: "updated_source",
        name: "Updated Source",
        description: "Updated description",
        defaultSize: { width: 320, height: 190 },
        defaultVisualStyle: {
          accentColor: "#f8fafc",
          iconKey: "factory"
        },
        ports: [{ key: "output", label: "Output", direction: "output" }],
        schema: {
          fields: [{ key: "email", label: "Email", type: "text" }]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: cardType.id,
      key: "updated_source",
      name: "Updated Source",
      description: "Updated description",
      defaultData,
      defaultSize: { width: 320, height: 190 },
      defaultVisualStyle: {
        accentColor: "#f8fafc",
        iconKey: "factory"
      },
      ports: [{ key: "output", label: "Output", direction: "output" }],
      schema: { fields: [{ key: "email", label: "Email", type: "text" }] }
    });

    const detail = await repository.getBoardDetail(seed.board.id);
    const updatedType = detail!.cardTypes.find((item) => item.id === cardType.id)!;
    const updatedCard = detail!.cards.find((item) => item.id === card.id)!;
    expect(updatedType.defaultData).toEqual(defaultData);
    expect(updatedCard.data).toEqual(cardData);

    await server.close();
  });

  it("rejects invalid card type updates", async () => {
    const { server, seed } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;
    const otherType = seed.cardTypes[1]!;

    for (const payload of [
      { key: otherType.key },
      { key: "" },
      { name: "" },
      {
        schema: {
          fields: [
            { key: "phone", label: "Phone", type: "text" },
            { key: "phone", label: "Duplicate", type: "number" }
          ]
        }
      },
      { schema: { fields: [{ key: "rating", label: "Rating", type: "formula" }] } }
    ]) {
      const response = await server.inject({
        method: "PATCH",
        url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}`,
        payload
      });
      expect([400, 409]).toContain(response.statusCode);
    }

    await server.close();
  });

  it("updates visual defaults without changing default data, schema-only fields, or card data", async () => {
    const { server, seed, repository } = createSchemaServer();
    const cardType = seed.cardTypes[0]!;
    const card = seed.cards.find((item) => item.cardTypeId === cardType.id)!;
    const defaultData = structuredClone(cardType.defaultData);
    const cardData = structuredClone(card.data);
    const schema = structuredClone(cardType.schema);

    const response = await server.inject({
      method: "PATCH",
      url: `/v2/boards/${seed.board.id}/card-types/${cardType.id}`,
      payload: {
        defaultSize: { width: 360, height: 210 },
        defaultVisualStyle: {
          accentColor: "#fb923c",
          iconKey: "box"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      defaultSize: { width: 360, height: 210 },
      defaultVisualStyle: {
        accentColor: "#fb923c",
        iconKey: "box"
      },
      defaultData,
      schema
    });

    const detail = await repository.getBoardDetail(seed.board.id);
    const updatedCard = detail!.cards.find((item) => item.id === card.id)!;
    expect(updatedCard.data).toEqual(cardData);

    await server.close();
  });

  it("creates new cards with type default size while type ports stay on the card type", async () => {
    const { server, seed } = createSchemaServer();

    const typeResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/card-types`,
      payload: {
        key: "visual_type",
        name: "Visual Type",
        defaultSize: { width: 280, height: 170 },
        defaultVisualStyle: {
          accentColor: "#60a5fa",
          iconKey: "box"
        }
      }
    });
    expect(typeResponse.statusCode).toBe(201);
    const cardType = typeResponse.json();

    const cardResponse = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/cards`,
      payload: {
        cardTypeId: cardType.id,
        title: "Uses defaults"
      }
    });

    expect(cardResponse.statusCode).toBe(201);
    expect(cardResponse.json()).toMatchObject({
      size: { width: 280, height: 170 },
      visualStyle: {}
    });

    const detailResponse = await server.inject({
      method: "GET",
      url: `/v2/boards/${seed.board.id}`
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      cardTypes: expect.arrayContaining([
        expect.objectContaining({
          id: cardType.id,
          defaultVisualStyle: { accentColor: "#60a5fa", iconKey: "box" },
          ports: [
            expect.objectContaining({ key: "input", direction: "input" }),
            expect.objectContaining({ key: "output", direction: "output" })
          ]
        })
      ])
    });

    await server.close();
  });
});
