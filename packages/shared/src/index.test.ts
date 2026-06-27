import { describe, expect, it } from "vitest";
import {
  boardSchema,
  buildCardInputFromTemplate,
  cardMetadataSchema,
  cardSchema,
  cardTemplates,
  createCardInputSchema,
  demoBoard,
  demoNotifications,
  demoUserIds,
  demoWorkspaceMembers,
  notificationSchema,
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
    expect(createCardInputSchema.parse({ title: "Draft idea", templateKey: "note" })).toEqual({
      title: "Draft idea",
      templateKey: "note"
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

  it("defines internal card metadata separately from user data", () => {
    expect(
      cardMetadataSchema.parse({
        typeKey: "note",
        inputs: ["input"],
        outputs: ["output"],
        tags: ["draft"],
        files: []
      })
    ).toEqual({
      typeKey: "note",
      inputs: ["input"],
      outputs: ["output"],
      tags: ["draft"],
      files: []
    });
  });

  it("builds create payloads from card templates", () => {
    expect(cardTemplates.map((template) => template.key)).toEqual([
      "trigger",
      "ai_action",
      "database",
      "vector_store",
      "storage",
      "note"
    ]);

    expect(buildCardInputFromTemplate("database", { sequence: 7 })).toMatchObject({
      typeKey: "database",
      title: "7. New Database Step",
      status: "draft",
      data: { table: "records", operation: "insert" },
      position: { x: 540, y: 290 },
      inputs: ["record"],
      outputs: ["record_id"],
      tags: ["database"]
    });

    expect(buildCardInputFromTemplate("missing", { sequence: 1 })).toBeNull();
  });

  it("defines valid demo workspace members", () => {
    expect(demoWorkspaceMembers).toHaveLength(3);
    expect(demoWorkspaceMembers.map((member) => member.role)).toEqual(["owner", "editor", "viewer"]);
    expect(demoWorkspaceMembers[0]).toMatchObject({
      name: "Alex Smith",
      email: "admin@acme.com",
      status: "active"
    });
  });

  it("defines valid scoped demo notifications", () => {
    expect(demoNotifications.map((notification) => notificationSchema.parse(notification))).toEqual(demoNotifications);

    const alexNotifications = demoNotifications.filter((notification) => notification.userId === demoUserIds.owner);
    const mayaNotifications = demoNotifications.filter((notification) => notification.userId === demoUserIds.editor);

    expect(alexNotifications).toHaveLength(2);
    expect(mayaNotifications).toHaveLength(1);
    expect(alexNotifications.filter((notification) => !notification.readAt)).toHaveLength(1);
  });
});
