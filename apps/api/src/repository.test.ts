import { describe, expect, it } from "vitest";
import { demoBoard, demoIds } from "@yadraw/shared";
import { createMemoryRepository } from "./repository.js";

describe("memory board repository", () => {
  it("returns the seeded board without sharing mutations between repositories", async () => {
    const firstRepository = createMemoryRepository();
    const secondRepository = createMemoryRepository();

    await firstRepository.createCard(demoIds.board, { title: "Isolated draft" });

    const firstBoard = await firstRepository.getBoard(demoIds.board);
    const secondBoard = await secondRepository.getBoard(demoIds.board);

    expect(firstBoard?.cards).toHaveLength(demoBoard.cards.length + 1);
    expect(secondBoard?.cards).toHaveLength(demoBoard.cards.length);
  });

  it("creates cards with stable defaults", async () => {
    const repository = createMemoryRepository();

    const card = await repository.createCard(demoIds.board, {
      title: "Manual review",
      typeKey: "approval",
      tags: ["ops"]
    });

    expect(card).toMatchObject({
      boardId: demoIds.board,
      typeKey: "approval",
      title: "Manual review",
      status: "draft",
      data: {},
      position: { x: 180, y: 160 },
      size: { width: 300, height: 175 },
      style: { accent: "blue" },
      inputs: ["input"],
      outputs: ["output"],
      files: [],
      tags: ["ops"]
    });
    expect(card?.id).toEqual(expect.any(String));
  });

  it("updates card content and layout fields", async () => {
    const repository = createMemoryRepository();
    const card = await repository.updateCard("6bb48e57-ed49-4fd6-bdbc-a449b2756be9", {
      title: "Enrich and classify",
      status: "approved",
      position: { x: 512, y: 256 },
      data: { model: "gpt", reviewed: true }
    });

    expect(card).toMatchObject({
      title: "Enrich and classify",
      status: "approved",
      position: { x: 512, y: 256 },
      data: { model: "gpt", reviewed: true }
    });
  });

  it("searches across title, description, type, tags, and data", async () => {
    const repository = createMemoryRepository();

    await repository.createCard(demoIds.board, {
      title: "Fulfillment package",
      description: "Send warehouse routing data",
      typeKey: "warehouse",
      data: { route: "north" },
      tags: ["logistics"]
    });

    await expect(repository.searchCards("warehouse")).resolves.toHaveLength(1);
    await expect(repository.searchCards("routing")).resolves.toHaveLength(1);
    await expect(repository.searchCards("north")).resolves.toHaveLength(1);
    await expect(repository.searchCards("logistics")).resolves.toHaveLength(1);
  });

  it("soft-deletes cards into trash and restores them", async () => {
    const repository = createMemoryRepository();
    const cardId = "6bb48e57-ed49-4fd6-bdbc-a449b2756be9";

    await expect(repository.deleteCard(cardId)).resolves.toMatchObject({
      id: cardId,
      title: "2. Enrich Data"
    });

    const boardAfterDelete = await repository.getBoard(demoIds.board);
    expect(boardAfterDelete?.cards.some((card) => card.id === cardId)).toBe(false);

    await expect(repository.listDeletedCards(demoIds.board)).resolves.toMatchObject([
      {
        id: cardId,
        status: "active"
      }
    ]);

    await expect(repository.restoreCard(cardId)).resolves.toMatchObject({
      id: cardId,
      status: "active"
    });

    const boardAfterRestore = await repository.getBoard(demoIds.board);
    expect(boardAfterRestore?.cards.some((card) => card.id === cardId)).toBe(true);
    await expect(repository.listDeletedCards(demoIds.board)).resolves.toEqual([]);
  });

  it("lists active board files with linked card context", async () => {
    const repository = createMemoryRepository();

    const files = await repository.listFiles(demoIds.board);

    expect(files).toHaveLength(5);
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "prompt.md",
          role: "source_document",
          cardId: "6bb48e57-ed49-4fd6-bdbc-a449b2756be9",
          cardTitle: "2. Enrich Data",
          cardTypeKey: "ai_action",
          cardStatus: "active"
        })
      ])
    );
  });

  it("excludes files from cards moved to trash", async () => {
    const repository = createMemoryRepository();

    await repository.deleteCard("6bb48e57-ed49-4fd6-bdbc-a449b2756be9");

    const files = await repository.listFiles(demoIds.board);
    expect(files.map((file) => file.filename)).not.toContain("prompt.md");
    expect(files).toHaveLength(4);
  });

  it("attaches file metadata to a card and exposes it in board files", async () => {
    const repository = createMemoryRepository();
    const cardId = "6bb48e57-ed49-4fd6-bdbc-a449b2756be9";

    const card = await repository.attachFile(cardId, {
      filename: " brief.pdf ",
      mimeType: "application/pdf",
      sizeBytes: 18_432,
      role: "attachment"
    });

    expect(card?.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "brief.pdf",
          mimeType: "application/pdf",
          sizeBytes: 18_432,
          role: "attachment"
        })
      ])
    );

    const files = await repository.listFiles(demoIds.board);
    expect(files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "brief.pdf",
          cardId,
          cardTitle: "2. Enrich Data"
        })
      ])
    );
  });

  it("returns null for missing boards and cards", async () => {
    const repository = createMemoryRepository();

    await expect(
      repository.createCard("a57baac3-0d79-4b95-bfdd-6366d7681c81", { title: "Missing" })
    ).resolves.toBeNull();
    await expect(repository.getBoard("a57baac3-0d79-4b95-bfdd-6366d7681c81")).resolves.toBeNull();
    await expect(repository.updateCard("a57baac3-0d79-4b95-bfdd-6366d7681c81", { title: "Missing" })).resolves.toBeNull();
    await expect(repository.deleteCard("a57baac3-0d79-4b95-bfdd-6366d7681c81")).resolves.toBeNull();
    await expect(repository.restoreCard("a57baac3-0d79-4b95-bfdd-6366d7681c81")).resolves.toBeNull();
    await expect(repository.listDeletedCards("a57baac3-0d79-4b95-bfdd-6366d7681c81")).resolves.toEqual([]);
    await expect(repository.listFiles("a57baac3-0d79-4b95-bfdd-6366d7681c81")).resolves.toEqual([]);
    await expect(
      repository.attachFile("a57baac3-0d79-4b95-bfdd-6366d7681c81", {
        filename: "missing.txt",
        role: "attachment"
      })
    ).resolves.toBeNull();
  });
});
