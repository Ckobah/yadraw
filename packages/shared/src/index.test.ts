import { describe, expect, it } from "vitest";
import {
  boardSchema,
  cardSchema,
  createCardInputSchema,
  demoBoard,
  updateCardInputSchema
} from "./index.js";

describe("shared data schemas", () => {
  it("accepts the demo board fixture", () => {
    expect(boardSchema.parse(demoBoard)).toEqual(demoBoard);
  });

  it("applies defaults for optional card collections", () => {
    const card = cardSchema.parse({
      id: "f545660f-6ef6-492a-af45-c39721f387df",
      boardId: demoBoard.id,
      typeKey: "note",
      title: "New card",
      position: { x: 24, y: 48 }
    });

    expect(card.status).toBe("draft");
    expect(card.size).toEqual({ width: 320, height: 180 });
    expect(card.data).toEqual({});
    expect(card.inputs).toEqual([]);
    expect(card.outputs).toEqual([]);
    expect(card.files).toEqual([]);
    expect(card.tags).toEqual([]);
  });

  it("accepts partial create and update payloads", () => {
    expect(createCardInputSchema.parse({ title: "Draft idea" })).toEqual({
      title: "Draft idea"
    });

    expect(
      updateCardInputSchema.parse({
        status: "approved",
        position: { x: 320, y: 180 },
        tags: ["reviewed"]
      })
    ).toEqual({
      status: "approved",
      position: { x: 320, y: 180 },
      tags: ["reviewed"]
    });
  });

  it("rejects invalid card status and non-positive sizes", () => {
    expect(() => updateCardInputSchema.parse({ status: "published" })).toThrow();
    expect(() =>
      createCardInputSchema.parse({
        size: { width: 0, height: 180 }
      })
    ).toThrow();
  });
});
