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

  it("returns null for missing boards and cards", async () => {
    const repository = createMemoryRepository();

    await expect(
      repository.createCard("a57baac3-0d79-4b95-bfdd-6366d7681c81", { title: "Missing" })
    ).resolves.toBeNull();
    await expect(repository.getBoard("a57baac3-0d79-4b95-bfdd-6366d7681c81")).resolves.toBeNull();
    await expect(repository.updateCard("a57baac3-0d79-4b95-bfdd-6366d7681c81", { title: "Missing" })).resolves.toBeNull();
  });
});
