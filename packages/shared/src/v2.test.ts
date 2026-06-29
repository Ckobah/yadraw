import { describe, expect, it } from "vitest";
import {
  v2ApiContracts,
  v2BoardDetailSchema,
  v2CardAttachmentSchema,
  v2CardFileSchema,
  v2CardSchema,
  v2CardVisualStyleSchema,
  v2CreateCardBodySchema,
  v2CreateConnectionBodySchema,
  v2FileProcessingStatusSchema,
  v2FileSchema,
  v2UpdateCardBodySchema
} from "./v2.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const boardId = "33333333-3333-4333-8333-333333333333";
const cardTypeId = "44444444-4444-4444-8444-444444444444";
const portId = "55555555-5555-4555-8555-555555555555";
const cardId = "66666666-6666-4666-8666-666666666666";
const fileId = "77777777-7777-4777-8777-777777777777";
const cardFileId = "88888888-8888-4888-8888-888888888888";

describe("v2 API contracts", () => {
  it("parses the minimal board detail DTO", () => {
    expect(
      v2BoardDetailSchema.parse({
        workspace: {
          id: workspaceId,
          name: "Local Workspace",
          slug: "local-workspace",
          createdAt: timestamp,
          updatedAt: timestamp
        },
        project: {
          id: projectId,
          workspaceId,
          name: "Core Project",
          createdAt: timestamp,
          updatedAt: timestamp
        },
        board: {
          id: boardId,
          workspaceId,
          projectId,
          name: "Main Board",
          viewport: { x: 0, y: 0, zoom: 1 },
          createdAt: timestamp,
          updatedAt: timestamp
        },
        cardTypes: [
          {
            id: cardTypeId,
            workspaceId,
            key: "source",
            name: "Source",
            description: "Provides input data.",
            defaultData: { kind: "source" },
            defaultSize: { width: 280, height: 160 },
            ports: [
              {
                id: portId,
                workspaceId,
                cardTypeId,
                key: "payload",
                label: "Payload",
                direction: "output",
                dataType: "json",
                required: true,
                sortOrder: 0,
                createdAt: timestamp,
                updatedAt: timestamp
              }
            ],
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        cards: [],
        connections: []
      })
    ).toMatchObject({
      workspace: { id: workspaceId },
      board: { id: boardId },
      cardTypes: [{ key: "source" }]
    });
  });

  it("rejects internal metadata in card data", () => {
    expect(() =>
      v2CreateCardBodySchema.parse({
        cardTypeId,
        title: "Bad card",
        data: { _yadraw: { ports: [] } }
      })
    ).toThrow();
  });

  it("allows visual style when creating cards", () => {
    expect(
      v2CreateCardBodySchema.parse({
        cardTypeId,
        title: "Styled card",
        visualStyle: {
          textAlign: "center",
          fontWeight: "700"
        }
      })
    ).toMatchObject({
      cardTypeId,
      title: "Styled card",
      visualStyle: {
        textAlign: "center",
        fontWeight: "700"
      }
    });
  });

  it("applies defaults for connection creation requests", () => {
    expect(
      v2CreateConnectionBodySchema.parse({
        sourceCardId: "66666666-6666-4666-8666-666666666666",
        targetCardId: "77777777-7777-4777-8777-777777777777",
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).toMatchObject({
      type: "data",
      label: ""
    });
  });

  it("keeps route contracts in an OpenAPI-style registry", () => {
    expect(v2ApiContracts.getBoard).toMatchObject({
      method: "GET",
      path: "/v2/boards/{boardId}"
    });
    expect(v2ApiContracts.createCard.body).toBe(v2CreateCardBodySchema);
    expect(v2ApiContracts.updateCard.body).toBe(v2UpdateCardBodySchema);
  });
});

describe("v2CardVisualStyleSchema", () => {
  it("accepts a full visual style", () => {
    expect(
      v2CardVisualStyleSchema.parse({
        fontFamily: "Inter",
        textAlign: "center",
        textColor: "#111827",
        fontWeight: "700",
        fontStyle: "italic",
        textDecoration: "underline"
      })
    ).toEqual({
      fontFamily: "Inter",
      textAlign: "center",
      textColor: "#111827",
      fontWeight: "700",
      fontStyle: "italic",
      textDecoration: "underline"
    });
  });

  it("accepts partial visual style", () => {
    expect(
      v2CardVisualStyleSchema.parse({
        textAlign: "right"
      })
    ).toEqual({ textAlign: "right" });
  });

  it("accepts empty object", () => {
    expect(v2CardVisualStyleSchema.parse({})).toEqual({});
  });

  it("rejects invalid textAlign", () => {
    expect(() =>
      v2CardVisualStyleSchema.parse({ textAlign: "justify" })
    ).toThrow();
  });

  it("rejects fontFamily over 80 chars", () => {
    expect(() =>
      v2CardVisualStyleSchema.parse({ fontFamily: "a".repeat(81) })
    ).toThrow();
  });

  it("rejects textColor over 32 chars", () => {
    expect(() =>
      v2CardVisualStyleSchema.parse({ textColor: "a".repeat(33) })
    ).toThrow();
  });

  it("accepts bodyVerticalAlign: top", () => {
    expect(
      v2CardVisualStyleSchema.parse({ bodyVerticalAlign: "top" })
    ).toEqual({ bodyVerticalAlign: "top" });
  });

  it("accepts bodyVerticalAlign: center", () => {
    expect(
      v2CardVisualStyleSchema.parse({ bodyVerticalAlign: "center" })
    ).toEqual({ bodyVerticalAlign: "center" });
  });

  it("accepts bodyVerticalAlign: bottom", () => {
    expect(
      v2CardVisualStyleSchema.parse({ bodyVerticalAlign: "bottom" })
    ).toEqual({ bodyVerticalAlign: "bottom" });
  });

  it("rejects invalid bodyVerticalAlign", () => {
    expect(() =>
      v2CardVisualStyleSchema.parse({ bodyVerticalAlign: "stretch" })
    ).toThrow();
  });

  it("rejects invalid text emphasis values", () => {
    expect(() =>
      v2CardVisualStyleSchema.parse({ fontWeight: "900" })
    ).toThrow();
    expect(() =>
      v2CardVisualStyleSchema.parse({ fontStyle: "oblique" })
    ).toThrow();
    expect(() =>
      v2CardVisualStyleSchema.parse({ textDecoration: "line-through" })
    ).toThrow();
  });
});

describe("v2CardSchema with visualStyle", () => {
  const baseCard = {
    id: cardId,
    workspaceId,
    boardId,
    cardTypeId,
    title: "Test Card",
    description: "A test card",
    data: { key: "value" },
    position: { x: 100, y: 200 },
    size: { width: 280, height: 170 },
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  } as const;

  it("defaults visualStyle to {} when omitted", () => {
    const card = v2CardSchema.parse(baseCard);
    expect(card.visualStyle).toEqual({});
  });

  it("accepts card with visualStyle", () => {
    const card = v2CardSchema.parse({
      ...baseCard,
      visualStyle: {
        fontFamily: "Mono",
        textAlign: "left",
        textColor: "#333",
        fontWeight: "700",
        fontStyle: "italic",
        textDecoration: "underline"
      }
    });
    expect(card.visualStyle).toEqual({
      fontFamily: "Mono",
      textAlign: "left",
      textColor: "#333",
      fontWeight: "700",
      fontStyle: "italic",
      textDecoration: "underline"
    });
  });
});

describe("v2 file attachment schemas", () => {
  const baseFile = {
    id: fileId,
    workspaceId,
    storageBucket: "workspace-files",
    storagePath: `${workspaceId}/cards/${cardId}/bearing.pdf`,
    filename: "bearing.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    sha256: "abc123",
    metadata: { source: "manual" },
    processingStatus: "pending",
    processingError: null,
    createdBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null
  } as const;

  it("accepts a valid file", () => {
    expect(v2FileSchema.parse(baseFile)).toMatchObject({
      id: fileId,
      workspaceId,
      filename: "bearing.pdf",
      processingStatus: "pending"
    });
  });

  it("rejects empty filename", () => {
    expect(() =>
      v2FileSchema.parse({
        ...baseFile,
        filename: ""
      })
    ).toThrow();
  });

  it("rejects negative sizeBytes", () => {
    expect(() =>
      v2FileSchema.parse({
        ...baseFile,
        sizeBytes: -1
      })
    ).toThrow();
  });

  it("rejects unknown processing status", () => {
    expect(() => v2FileProcessingStatusSchema.parse("queued")).toThrow();
  });

  it("accepts a valid card-file link", () => {
    expect(
      v2CardFileSchema.parse({
        id: cardFileId,
        workspaceId,
        cardId,
        fileId,
        role: "attachment",
        metadata: { pinned: true },
        file: baseFile,
        createdBy: null,
        createdAt: timestamp,
        deletedAt: null
      })
    ).toMatchObject({
      id: cardFileId,
      cardId,
      fileId,
      role: "attachment"
    });
  });

  it("accepts a compact card attachment", () => {
    expect(
      v2CardAttachmentSchema.parse({
        id: cardFileId,
        cardId,
        fileId,
        role: "attachment",
        filename: "bearing.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        processingStatus: "processed",
        createdAt: timestamp
      })
    ).toMatchObject({
      filename: "bearing.pdf",
      processingStatus: "processed"
    });
  });

  it("rejects negative sizeBytes in compact card attachment", () => {
    expect(() =>
      v2CardAttachmentSchema.parse({
        id: cardFileId,
        cardId,
        fileId,
        role: "attachment",
        filename: "bearing.pdf",
        sizeBytes: -1,
        processingStatus: "processed",
        createdAt: timestamp
      })
    ).toThrow();
  });
});

describe("v2UpdateCardBodySchema with visualStyle", () => {
  it("allows updating visualStyle alone", () => {
    const result = v2UpdateCardBodySchema.parse({
      visualStyle: { textAlign: "center" }
    });
    expect(result).toEqual({ visualStyle: { textAlign: "center" } });
  });

  it("rejects unknown fields alongside visualStyle", () => {
    expect(() =>
      v2UpdateCardBodySchema.parse({
        visualStyle: { textAlign: "center" },
        unknownField: true
      })
    ).toThrow();
  });

  it("accepts visualStyle with bodyVerticalAlign in update body", () => {
    const result = v2UpdateCardBodySchema.parse({
      visualStyle: {
        bodyVerticalAlign: "bottom",
        textAlign: "left",
        fontWeight: "700",
        fontStyle: "italic",
        textDecoration: "underline"
      }
    });
    expect(result).toEqual({
      visualStyle: {
        bodyVerticalAlign: "bottom",
        textAlign: "left",
        fontWeight: "700",
        fontStyle: "italic",
        textDecoration: "underline"
      }
    });
  });
});

