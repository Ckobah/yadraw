import { describe, expect, it } from "vitest";
import { demoIds, demoUserIds } from "@yadraw/shared";
import type { RequestContext } from "../context.js";
import { createMemoryRepository } from "../repository.js";
import { createBoardCore } from "./board-service.js";
import { CoreError } from "./errors.js";

const editorContext: RequestContext = {
  userId: demoUserIds.editor,
  source: "header"
};

const viewerContext: RequestContext = {
  userId: demoUserIds.viewer,
  source: "header"
};

describe("board core", () => {
  it("creates cards through the use case layer and writes an audit event", async () => {
    const repository = createMemoryRepository();
    const core = createBoardCore(repository);

    const card = await core.createCard(editorContext, demoIds.board, {
      templateKey: "database",
      title: "Persist order"
    });

    expect(card).toMatchObject({
      boardId: demoIds.board,
      typeKey: "database",
      title: "Persist order"
    });

    await expect(repository.listActivityLog("card", card.id)).resolves.toMatchObject([
      {
        workspaceId: demoIds.workspace,
        actorId: demoUserIds.editor,
        action: "card.create",
        objectType: "card",
        objectId: card.id,
        after: expect.objectContaining({
          id: card.id,
          title: "Persist order"
        })
      }
    ]);
  });

  it("keeps write authorization in policy instead of route handlers", async () => {
    const repository = createMemoryRepository();
    const core = createBoardCore(repository);

    await expect(
      core.createCard(viewerContext, demoIds.board, {
        title: "Viewer write"
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "forbidden"
    });

    const board = await repository.getBoard(demoIds.board);
    expect(board?.cards.map((card) => card.title)).not.toContain("Viewer write");
  });

  it("returns structured validation errors from core parsing", async () => {
    const repository = createMemoryRepository();
    const core = createBoardCore(repository);

    await expect(
      core.attachFile(editorContext, "6bb48e57-ed49-4fd6-bdbc-a449b2756be9", {
        filename: ""
      })
    ).rejects.toBeInstanceOf(CoreError);

    await expect(
      core.attachFile(editorContext, "6bb48e57-ed49-4fd6-bdbc-a449b2756be9", {
        filename: ""
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "invalid_payload",
      fields: expect.objectContaining({
        filename: expect.any(Array)
      })
    });
  });

  it("audits before and after snapshots for card updates", async () => {
    const repository = createMemoryRepository();
    const core = createBoardCore(repository);
    const cardId = "6bb48e57-ed49-4fd6-bdbc-a449b2756be9";

    const updated = await core.updateCard(editorContext, cardId, {
      title: "Reviewed enrichment",
      data: { reviewed: true }
    });

    expect(updated).toMatchObject({
      id: cardId,
      title: "Reviewed enrichment",
      data: { reviewed: true }
    });

    await expect(repository.listActivityLog("card", cardId)).resolves.toMatchObject([
      {
        action: "card.update",
        before: expect.objectContaining({
          title: "2. Enrich Data"
        }),
        after: expect.objectContaining({
          title: "Reviewed enrichment",
          data: { reviewed: true }
        })
      }
    ]);
  });
});
