import { describe, expect, it, vi } from "vitest";
import {
  createDefaultV2MemorySeed,
  createV2MemoryRepository,
  type V2BootstrapUserInput
} from "./repository.js";
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
  const genericConnectionType = seed.connectionTypes?.find((connectionType) => connectionType.key === "generic");
  const containsConnectionType = seed.connectionTypes?.find((connectionType) => connectionType.key === "contains");

  if (!sourceType || !taskType || !genericConnectionType || !containsConnectionType) {
    throw new Error("Invalid v2 memory seed");
  }

  return { seed, sourceType, taskType, genericConnectionType, containsConnectionType };
}

describe("v2 board service", () => {
  it("uses authenticated context for dashboard and bootstrap operations", async () => {
    const { seed } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const timestamp = "2026-01-01T00:00:00.000Z";
    const bootstrap = vi.fn(async (input: V2BootstrapUserInput) => ({
      created: true,
      user: {
        id: input.userId,
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl
      },
      workspace: {
        id: seed.workspace.id,
        name: seed.workspace.name,
        slug: seed.workspace.slug,
        role: "owner" as const,
        updatedAt: timestamp
      },
      board: {
        id: seed.board.id,
        workspaceId: seed.workspace.id,
        name: seed.board.name,
        updatedAt: timestamp
      }
    }));
    repository.bootstrapPersonalWorkspace = bootstrap;
    repository.listUserWorkspaces = vi.fn(async () => [{
      id: seed.workspace.id,
      name: seed.workspace.name,
      slug: seed.workspace.slug,
      role: "owner" as const,
      updatedAt: timestamp
    }]);
    repository.listWorkspaceBoards = vi.fn(async () => [{
      id: seed.board.id,
      workspaceId: seed.workspace.id,
      name: seed.board.name,
      updatedAt: timestamp
    }]);
    repository.createBoard = vi.fn(async (workspaceId: string, name: string) => ({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workspaceId,
      name,
      updatedAt: timestamp
    }));
    const service = createV2BoardService(repository);

    await expect(service.bootstrapSession(ownerContext, {
      email: "Owner@Example.com",
      name: "Owner",
      avatarUrl: null,
      authProvider: "supabase"
    })).resolves.toMatchObject({ created: true, user: { id: ownerContext.userId } });
    expect(bootstrap).toHaveBeenCalledWith(expect.objectContaining({
      userId: ownerContext.userId,
      email: "owner@example.com"
    }));
    await expect(service.listWorkspaces(ownerContext)).resolves.toMatchObject({
      workspaces: [expect.objectContaining({ id: seed.workspace.id })]
    });
    await expect(service.createBoard(ownerContext, seed.workspace.id, { name: "New board" }))
      .resolves.toMatchObject({ name: "New board" });
    await expect(service.createBoard(viewerContext, seed.workspace.id, { name: "Denied" }))
      .rejects.toMatchObject({ code: "forbidden" });
  });

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
    const { seed, sourceType, genericConnectionType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));

    await expect(service.getBoard(viewerContext, seed.board.id)).resolves.toMatchObject({
      board: { id: seed.board.id },
      cardTypes: expect.arrayContaining([
        expect.objectContaining({
          id: sourceType.id,
          schema: { fields: [] }
        })
      ]),
      connectionTypes: expect.arrayContaining([
        expect.objectContaining({
          id: genericConnectionType.id,
          key: "generic",
          schema: { fields: [] }
        })
      ])
    });
    await expect(service.listCardTypes(viewerContext, seed.workspace.id)).resolves.toMatchObject({
      cardTypes: expect.arrayContaining([
        expect.objectContaining({
          id: sourceType.id,
          schema: { fields: [] }
        })
      ])
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
    const { seed, sourceType, taskType, containsConnectionType } = getSeedParts();
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
      connectionTypeId: containsConnectionType.id,
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    expect(connection).toMatchObject({
      boardId: seed.board.id,
      sourceCardId: source.id,
      targetCardId: task.id,
      connectionTypeId: containsConnectionType.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      type: "data",
      status: "active"
    });
  });

  it("creates connections without a type by using the generic fallback when available", async () => {
    const { seed, sourceType, taskType, genericConnectionType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });

    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).resolves.toMatchObject({
      connectionTypeId: genericConnectionType.id
    });
  });

  it("rejects invalid or soft-deleted connection types", async () => {
    const { seed, sourceType, taskType, containsConnectionType } = getSeedParts();
    const service = createV2BoardService(
      createV2MemoryRepository({
        ...seed,
        deletedConnectionTypeIds: [containsConnectionType.id]
      })
    );
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });

    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        connectionTypeId: containsConnectionType.id,
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).rejects.toMatchObject({ code: "validation_failed" });

    await expect(
      service.createConnection(ownerContext, seed.board.id, {
        connectionTypeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sourceCardId: source.id,
        targetCardId: task.id,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("patches connection type while preserving relationship data and visual style", async () => {
    const { seed, sourceType, taskType, containsConnectionType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
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
      data: { quantity: 8, unit: "pcs" },
      visualStyle: { strokeColor: "#2563eb", strokeWidth: 3 }
    });

    const typed = await service.updateConnection(ownerContext, styled.id, {
      connectionTypeId: containsConnectionType.id
    });

    expect(typed).toMatchObject({
      id: connection.id,
      connectionTypeId: containsConnectionType.id,
      data: { quantity: 8, unit: "pcs" },
      visualStyle: { strokeColor: "#2563eb", strokeWidth: 3 }
    });
    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.cards.find((card) => card.id === source.id)?.data).toEqual({ sourceBusiness: true });
    expect(detail.cards.find((card) => card.id === task.id)?.data).toEqual({ targetBusiness: true });
  });

  it("keeps incomplete quantitative relationships as drafts and activates them after valid autosave", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const quantitativeType = await service.createConnectionType(ownerContext, seed.board.id, {
      key: "requires_quantity",
      name: "Requires quantity",
      schema: {
        fields: [
          {
            key: "quantity",
            label: "Quantity",
            type: "number",
            required: true,
            numberConstraints: { min: 0 }
          },
          {
            key: "unit",
            label: "Unit",
            type: "select",
            required: true,
            options: [{ value: "piece", label: "Pieces" }]
          }
        ],
        semantics: {
          version: 1,
          sourceRole: "component",
          targetRole: "assembly",
          quantity: {
            valueField: "quantity",
            unitField: "unit",
            basis: "per_target",
            targetMultiplierField: "plannedQuantity",
            aggregation: "sum"
          }
        }
      },
      defaultVisualStyle: {}
    });
    const component = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id
    });
    const assembly = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      data: { plannedQuantity: 2 }
    });

    const draft = await service.createConnection(ownerContext, seed.board.id, {
      connectionTypeId: quantitativeType.id,
      sourceCardId: component.id,
      targetCardId: assembly.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });
    expect(draft.status).toBe("draft");

    const draftEvaluation = await service.evaluateBoardCalculations(
      viewerContext,
      seed.board.id
    );
    expect(draftEvaluation.results).toEqual([]);
    expect(draftEvaluation.warnings).toEqual([
      expect.objectContaining({ code: "draft_quantitative_connection", connectionId: draft.id })
    ]);

    const active = await service.updateConnection(ownerContext, draft.id, {
      data: { quantity: 5, unit: "piece" }
    });
    expect(active.status).toBe("active");

    const evaluation = await service.evaluateBoardCalculations(viewerContext, seed.board.id);
    expect(evaluation.results).toEqual([
      expect.objectContaining({
        connectionId: draft.id,
        sourceCardId: component.id,
        targetCardId: assembly.id,
        value: 10,
        unitCode: "piece"
      })
    ]);
    expect(evaluation.totals).toEqual([
      expect.objectContaining({ cardId: component.id, value: 10, unitCode: "piece" })
    ]);

    const graph = await service.getSemanticGraph(viewerContext, seed.board.id);
    expect(graph.graphRevision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(graph.relations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: draft.id,
        predicate: "requires_quantity",
        source: expect.objectContaining({ role: "component" }),
        target: expect.objectContaining({ role: "assembly" }),
        quantity: expect.objectContaining({ value: 5, unitCode: "piece" })
      })
    ]));
  });

  it("allows different semantic connection types between the same typed ports", async () => {
    const { seed, sourceType, taskType, containsConnectionType, genericConnectionType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const target = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });
    const endpoint = {
      sourceCardId: source.id,
      targetCardId: target.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    };

    await expect(service.createConnection(ownerContext, seed.board.id, {
      ...endpoint,
      connectionTypeId: containsConnectionType.id
    })).resolves.toMatchObject({ connectionTypeId: containsConnectionType.id });
    await expect(service.createConnection(ownerContext, seed.board.id, {
      ...endpoint,
      connectionTypeId: genericConnectionType.id
    })).resolves.toMatchObject({ connectionTypeId: genericConnectionType.id });
  });

  it("applies type defaults in semantic projections without rewriting existing relationships", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const type = await service.createConnectionType(ownerContext, seed.board.id, {
      key: "schema_upgrade",
      name: "Schema upgrade",
      schema: { fields: [] },
      defaultVisualStyle: {}
    });
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const target = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      connectionTypeId: type.id,
      sourceCardId: source.id,
      targetCardId: target.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await service.updateConnectionType(ownerContext, seed.board.id, type.id, {
      schema: {
        fields: [
          {
            key: "quantity",
            label: "Quantity",
            type: "number",
            required: true,
            defaultValue: 1
          },
          {
            key: "unit",
            label: "Unit",
            type: "text",
            required: true,
            defaultValue: "piece"
          }
        ],
        semantics: {
          version: 1,
          sourceRole: "component",
          targetRole: "assembly",
          quantity: {
            valueField: "quantity",
            unitField: "unit",
            basis: "absolute",
            aggregation: "sum"
          }
        }
      }
    });
    await expect(repository.getConnection(connection.id)).resolves.toMatchObject({
      status: "active",
      data: {}
    });
    await expect(service.evaluateBoardCalculations(viewerContext, seed.board.id)).resolves.toMatchObject({
      results: [expect.objectContaining({ connectionId: connection.id, value: 1, unitCode: "piece" })]
    });
    await expect(service.getSemanticGraph(viewerContext, seed.board.id)).resolves.toMatchObject({
      relations: expect.arrayContaining([
        expect.objectContaining({
          id: connection.id,
          data: { quantity: 1, unit: "piece" },
          validity: "valid"
        })
      ])
    });

    await service.updateConnectionType(ownerContext, seed.board.id, type.id, {
      schema: {
        fields: [
          {
            key: "quantity",
            label: "Quantity",
            type: "number",
            required: true,
            defaultValue: 1
          },
          {
            key: "unit",
            label: "Unit",
            type: "text",
            required: true,
            defaultValue: "piece"
          },
          { key: "batch", label: "Batch", type: "text", required: true }
        ],
        semantics: {
          version: 1,
          sourceRole: "component",
          targetRole: "assembly",
          quantity: {
            valueField: "quantity",
            unitField: "unit",
            basis: "absolute",
            aggregation: "sum"
          }
        }
      }
    });
    await expect(repository.getConnection(connection.id)).resolves.toMatchObject({
      status: "active",
      data: {}
    });
    await expect(service.evaluateBoardCalculations(viewerContext, seed.board.id)).resolves.toMatchObject({
      results: [],
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: "missing_required", connectionId: connection.id })
      ])
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

  it("updates connection relationship data without mutating card data", async () => {
    const { seed, sourceType, taskType, containsConnectionType } = getSeedParts();
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const source = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      data: { part: "bolt" }
    });
    const task = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      data: { assembly: "frame" }
    });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      connectionTypeId: containsConnectionType.id,
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    const updated = await service.updateConnection(ownerContext, connection.id, {
      data: {
        quantity: 4,
        unit: "pcs",
        note: "M6 bolts per assembly"
      }
    });

    expect(updated.data).toEqual({
      quantity: 4,
      unit: "pcs",
      note: "M6 bolts per assembly"
    });
    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.cards.find((card) => card.id === source.id)?.data).toEqual({ part: "bolt" });
    expect(detail.cards.find((card) => card.id === task.id)?.data).toEqual({ assembly: "frame" });
  });

  it("retargets connection endpoints while preserving metadata, visual style, and connection type", async () => {
    const { seed, sourceType, taskType, containsConnectionType } = getSeedParts();
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
    const nextTask = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id,
      data: { nextTargetBusiness: true }
    });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      connectionTypeId: containsConnectionType.id,
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });
    const styled = await service.updateConnection(ownerContext, connection.id, {
      title: "Assembly quantity",
      data: { quantity: 4, unit: "pcs" },
      visualStyle: { strokeColor: "#2563eb", strokeWidth: 3 }
    });

    const retargeted = await service.updateConnection(ownerContext, styled.id, {
      targetCardId: nextTask.id,
      targetPortKey: "input"
    });

    expect(retargeted).toMatchObject({
      id: connection.id,
      sourceCardId: source.id,
      targetCardId: nextTask.id,
      connectionTypeId: containsConnectionType.id,
      sourcePortKey: "payload",
      targetPortKey: "input",
      title: "Assembly quantity",
      data: { quantity: 4, unit: "pcs" },
      visualStyle: { strokeColor: "#2563eb", strokeWidth: 3 }
    });
    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.cards.find((card) => card.id === source.id)?.data).toEqual({ sourceBusiness: true });
    expect(detail.cards.find((card) => card.id === task.id)?.data).toEqual({ targetBusiness: true });
    expect(detail.cards.find((card) => card.id === nextTask.id)?.data).toEqual({ nextTargetBusiness: true });
  });

  it("rejects invalid or duplicate connection retargets", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const source = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const secondSource = await service.createCard(ownerContext, seed.board.id, { cardTypeId: sourceType.id });
    const task = await service.createCard(ownerContext, seed.board.id, { cardTypeId: taskType.id });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: source.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });
    const duplicateCandidate = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: secondSource.id,
      targetCardId: task.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    await expect(
      service.updateConnection(ownerContext, connection.id, {
        targetPortKey: "missing"
      })
    ).rejects.toMatchObject({ code: "validation_failed" });

    await expect(
      service.updateConnection(ownerContext, duplicateCandidate.id, {
        sourceCardId: source.id
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("deletes a connector without deleting connected cards", async () => {
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

    await expect(service.deleteConnection(ownerContext, connection.id)).resolves.toEqual({
      deleted: true,
      id: connection.id
    });

    const detail = await service.getBoard(ownerContext, seed.board.id);
    expect(detail.connections.map((item) => item.id)).not.toContain(connection.id);
    expect(detail.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining([source.id, task.id])
    );
    await expect(repository.getConnection(connection.id)).resolves.toBeNull();
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
        ],
        labelPosition: { x: 350, y: 240 },
        labelSegmentIndex: 1
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
      ],
      labelPosition: { x: 350, y: 240 },
      labelSegmentIndex: 1
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
        ],
        labelPosition: { x: 350, y: 240 },
        labelSegmentIndex: 1
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
      connectionTypeId: null,
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
      connectionTypeId: null,
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

  it("keeps linked card content live and snapshots it when unlinked", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    sourceType.schema = {
      fields: [{ key: "code", label: "Code", type: "text" }]
    };
    const repository = createV2MemoryRepository(seed);
    const service = createV2BoardService(repository);
    const first = await service.createCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      { title: "Northwind", data: { code: "NW" } }
    );
    const second = await service.createCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      { title: "Contoso", data: { code: "CT" } }
    );
    const linkedCard = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: sourceType.id,
      libraryEntryId: first.id,
      position: { x: 120, y: 240 }
    });
    const target = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id
    });
    const connection = await service.createConnection(ownerContext, seed.board.id, {
      sourceCardId: linkedCard.id,
      targetCardId: target.id,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    const switched = await service.setCardLibraryEntry(ownerContext, linkedCard.id, {
      libraryEntryId: second.id,
      expectedLibraryEntryId: first.id
    });
    expect(switched).toMatchObject({
      id: linkedCard.id,
      libraryEntryId: second.id,
      title: "Contoso",
      data: { code: "CT" },
      position: { x: 120, y: 240 }
    });
    await expect(
      service.setCardLibraryEntry(ownerContext, linkedCard.id, {
        libraryEntryId: first.id,
        expectedLibraryEntryId: null
      })
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(service.duplicateCard(ownerContext, linkedCard.id)).resolves.toMatchObject({
      libraryEntryId: second.id,
      title: "Contoso",
      data: { code: "CT" }
    });

    await service.updateCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      second.id,
      { title: "Contoso Ltd", data: { code: "CTL" }, expectedVersion: 1 }
    );
    await expect(service.getBoard(ownerContext, seed.board.id)).resolves.toMatchObject({
      cards: expect.arrayContaining([
        expect.objectContaining({
          id: linkedCard.id,
          title: "Contoso Ltd",
          data: { code: "CTL" }
        })
      ]),
      connections: expect.arrayContaining([expect.objectContaining({ id: connection.id })])
    });
    await expect(
      service.updateCard(ownerContext, linkedCard.id, { title: "Local override" })
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.updateCard(ownerContext, linkedCard.id, { position: { x: 300, y: 400 } })
    ).resolves.toMatchObject({ title: "Contoso Ltd", position: { x: 300, y: 400 } });

    const unlinked = await service.setCardLibraryEntry(ownerContext, linkedCard.id, {
      libraryEntryId: null,
      expectedLibraryEntryId: second.id
    });
    expect(unlinked).toMatchObject({
      libraryEntryId: null,
      title: "Contoso Ltd",
      data: { code: "CTL" }
    });
    await service.updateCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      second.id,
      { title: "Contoso Global", expectedVersion: 2 }
    );
    await expect(repository.getCard(linkedCard.id)).resolves.toMatchObject({
      libraryEntryId: null,
      title: "Contoso Ltd",
      data: { code: "CTL" }
    });
  });

  it("validates library rows, permissions, archival state, and optimistic versions", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    sourceType.schema = {
      fields: [
        { key: "taxId", label: "Tax ID", type: "text", required: true },
        {
          key: "tier",
          label: "Tier",
          type: "select",
          options: [
            { value: "primary", label: "Primary" },
            { value: "backup", label: "Backup" }
          ]
        }
      ]
    };
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const incomplete = await service.createCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      { title: "Draft supplier" }
    );
    expect(incomplete).toMatchObject({ selectable: false });
    expect(incomplete.validationIssues).toEqual([
      expect.objectContaining({ code: "required", fieldKey: "taxId" })
    ]);
    await expect(
      service.createCard(ownerContext, seed.board.id, {
        cardTypeId: sourceType.id,
        libraryEntryId: incomplete.id
      })
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      service.createCardLibraryEntry(ownerContext, seed.workspace.id, sourceType.id, {
        title: "Invalid supplier",
        data: { taxId: "7701", tier: "unknown" }
      })
    ).rejects.toMatchObject({ code: "validation_failed" });

    const valid = await service.createCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      { title: "Valid supplier", data: { taxId: "7701", tier: "primary" } }
    );
    const taskCard = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: taskType.id
    });
    await expect(
      service.setCardLibraryEntry(ownerContext, taskCard.id, {
        libraryEntryId: valid.id,
        expectedLibraryEntryId: null
      })
    ).rejects.toMatchObject({ code: "validation_failed" });
    await expect(
      service.listCardLibraryEntries(viewerContext, seed.workspace.id, sourceType.id, {})
    ).resolves.toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ id: valid.id })]) });
    await expect(
      service.createCardLibraryEntry(viewerContext, seed.workspace.id, sourceType.id, {
        title: "Denied"
      })
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.updateCardLibraryEntry(
        ownerContext,
        seed.workspace.id,
        sourceType.id,
        valid.id,
        { title: "Stale update", expectedVersion: 99 }
      )
    ).rejects.toMatchObject({ code: "conflict" });

    const archived = await service.updateCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      valid.id,
      { archived: true, expectedVersion: 1 }
    );
    expect(archived).toMatchObject({ selectable: false });
    await expect(
      service.createCard(ownerContext, seed.board.id, {
        cardTypeId: sourceType.id,
        libraryEntryId: valid.id
      })
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("paginates and searches each card type library independently", async () => {
    const { seed, sourceType, taskType } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    for (const title of ["Alpha Supply", "Beta Supply", "Gamma Supply"]) {
      await service.createCardLibraryEntry(ownerContext, seed.workspace.id, sourceType.id, {
        title
      });
    }
    await service.createCardLibraryEntry(ownerContext, seed.workspace.id, taskType.id, {
      title: "Alpha task"
    });

    const firstPage = await service.listCardLibraryEntries(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      { limit: 2 }
    );
    expect(firstPage.entries.map((entry) => entry.title)).toEqual([
      "Alpha Supply",
      "Beta Supply"
    ]);
    expect(firstPage.nextCursor).toBeTruthy();
    const secondPage = await service.listCardLibraryEntries(
      ownerContext,
      seed.workspace.id,
      sourceType.id,
      { limit: 2, cursor: firstPage.nextCursor! }
    );
    expect(secondPage.entries.map((entry) => entry.title)).toEqual(["Gamma Supply"]);
    await expect(
      service.listCardLibraryEntries(ownerContext, seed.workspace.id, sourceType.id, {
        query: "beta"
      })
    ).resolves.toMatchObject({ entries: [expect.objectContaining({ title: "Beta Supply" })] });
  });

  it("blocks deleting used entries and card types that still own library rows", async () => {
    const { seed } = getSeedParts();
    const service = createV2BoardService(createV2MemoryRepository(seed));
    const supplierType = await service.createCardType(ownerContext, seed.board.id, {
      key: "supplier_library_test",
      name: "Supplier",
      schema: { fields: [] },
      ports: []
    });
    const entry = await service.createCardLibraryEntry(
      ownerContext,
      seed.workspace.id,
      supplierType.id,
      { title: "Northwind" }
    );
    const card = await service.createCard(ownerContext, seed.board.id, {
      cardTypeId: supplierType.id,
      libraryEntryId: entry.id
    });

    await expect(
      service.deleteCardLibraryEntry(
        ownerContext,
        seed.workspace.id,
        supplierType.id,
        entry.id,
        { expectedVersion: 1 }
      )
    ).rejects.toMatchObject({ code: "conflict" });
    await service.setCardLibraryEntry(ownerContext, card.id, {
      libraryEntryId: null,
      expectedLibraryEntryId: entry.id
    });
    await expect(
      service.deleteCardType(ownerContext, seed.board.id, supplierType.id)
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      service.deleteCardLibraryEntry(
        viewerContext,
        seed.workspace.id,
        supplierType.id,
        entry.id,
        { expectedVersion: 1 }
      )
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      service.deleteCardLibraryEntry(
        ownerContext,
        seed.workspace.id,
        supplierType.id,
        entry.id,
        { expectedVersion: 1 }
      )
    ).resolves.toEqual({ deleted: true, id: entry.id });
  });
});

