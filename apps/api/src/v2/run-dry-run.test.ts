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

function createRunDryRunServer(
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

describe("v2 run dry-run API", () => {
  it("returns an empty dry-run result for an empty board", async () => {
    const { server, seed } = createRunDryRunServer(ownerContext, (draft) => {
      draft.cards = [];
      draft.connections = [];
    });

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/run/dry-run`,
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      mode: "dry-run",
      boardId: seed.board.id,
      steps: [],
      warnings: ["Board has no cards to dry-run"]
    });
    await server.close();
  });

  it("starts from a selected start card", async () => {
    const { server, seed } = createRunDryRunServer();
    const startCard = seed.cards[1]!;

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/run/dry-run`,
      payload: { startCardId: startCard.id }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      mode: "dry-run",
      boardId: seed.board.id,
      startCardId: startCard.id,
      steps: [
        {
          cardId: startCard.id,
          title: startCard.title,
          type: "task",
          status: "would_run",
          message: "Would process this card"
        }
      ],
      warnings: [`No outgoing connections from "${startCard.title}"`]
    });
    await server.close();
  });

  it("follows outgoing connections in deterministic order", async () => {
    const { server, seed } = createRunDryRunServer(ownerContext, (draft) => {
      const extraCard = {
        ...draft.cards[1]!,
        id: "99999999-9999-4999-8999-999999999991",
        title: "Archive payload",
        data: { kind: "task", operation: "archive" },
        createdAt: "2026-01-01T00:00:02.000Z",
        updatedAt: "2026-01-01T00:00:02.000Z"
      };
      draft.cards.push(extraCard);
      draft.connections.push({
        ...draft.connections[0]!,
        id: "99999999-9999-4999-8999-999999999992",
        targetCardId: extraCard.id,
        label: "archive",
        createdAt: "2026-01-01T00:00:03.000Z",
        updatedAt: "2026-01-01T00:00:03.000Z"
      });
    });

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/run/dry-run`,
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().steps.map((step: { title: string }) => step.title)).toEqual([
      "Incoming data",
      "Normalize payload",
      "Archive payload"
    ]);
    await server.close();
  });

  it("handles cycles without crashing", async () => {
    const { server, seed } = createRunDryRunServer(ownerContext, (draft) => {
      draft.connections.push({
        ...draft.connections[0]!,
        id: "99999999-9999-4999-8999-999999999993",
        sourceCardId: draft.cards[1]!.id,
        targetCardId: draft.cards[0]!.id,
        sourcePortKey: "result",
        targetPortKey: "payload",
        label: "cycle",
        createdAt: "2026-01-01T00:00:03.000Z",
        updatedAt: "2026-01-01T00:00:03.000Z"
      });
    });

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/run/dry-run`,
      payload: { startCardId: seed.cards[0]!.id }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().steps.map((step: { cardId: string }) => step.cardId)).toEqual([
      seed.cards[0]!.id,
      seed.cards[1]!.id
    ]);
    expect(response.json().warnings).toContain(
      `Cycle detected: "${seed.cards[1]!.title}" -> "${seed.cards[0]!.title}"`
    );
    await server.close();
  });

  it("is read-only for cards, connections, card data, and visual style", async () => {
    const { server, seed, repository } = createRunDryRunServer();
    const before = await repository.getBoardDetail(seed.board.id);

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/run/dry-run`,
      payload: { startCardId: seed.cards[0]!.id }
    });

    const after = await repository.getBoardDetail(seed.board.id);
    expect(response.statusCode).toBe(200);
    expect(after).toEqual(before);
    await server.close();
  });

  it("rejects inaccessible boards", async () => {
    const { server, seed } = createRunDryRunServer(outsideContext);

    const response = await server.inject({
      method: "POST",
      url: `/v2/boards/${seed.board.id}/run/dry-run`,
      payload: {}
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "forbidden" } });
    await server.close();
  });
});
