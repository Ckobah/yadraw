import { describe, expect, it } from "vitest";
import {
  v2ApiContracts,
  v2BoardDetailSchema,
  v2BootstrapSessionBodySchema,
  v2BootstrapSessionResponseSchema,
  v2CardAttachmentSchema,
  v2CardFileSchema,
  v2CardLibraryEntryListResponseSchema,
  v2CardLibraryEntrySchema,
  v2CardTypeDefinitionSchema,
  v2CardTypeSchema as v2CardTypeEntitySchema,
  v2CardSchema,
  v2CardVisualStyleSchema,
  v2ConnectionAttachmentSchema,
  v2ConnectionFileSchema,
  v2ConnectionTypeDefinitionSchema,
  v2ConnectionTypeSchema,
  v2CreateConnectionTypeBodySchema,
  v2ConnectionVisualStyleSchema,
  v2CreateCardBodySchema,
  v2CreateBoardBodySchema,
  v2CreateCardLibraryEntryBodySchema,
  v2CreateCardTypeBodySchema,
  v2CreateConnectionBodySchema,
  v2ConnectionSchema,
  v2CreateLinkedFieldBindingBodySchema,
  v2DeleteCardLibraryEntryQuerySchema,
  v2DryRunResultSchema,
  v2FileProcessingStatusSchema,
  v2FileSchema,
  v2LinkedFieldBindingSchema,
  v2LinkedFieldBindingListResponseSchema,
  v2ListCardLibraryEntriesQuerySchema,
  v2RunDryRunBodySchema,
  v2SetCardLibraryEntryBodySchema,
  v2UpdateBoardLayoutBodySchema,
  v2UpdateCardLibraryEntryBodySchema,
  v2UpdateCardTypeBodySchema,
  v2UpdateConnectionTypeBodySchema,
  v2UpdateLinkedFieldBindingBodySchema,
  v2UpdateConnectionBodySchema,
  v2UpdateCardTypeSchemaBodySchema,
  v2UpdateCardBodySchema
} from "./v2.js";

const timestamp = "2026-01-01T00:00:00.000Z";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const boardId = "33333333-3333-4333-8333-333333333333";
const cardTypeId = "44444444-4444-4444-8444-444444444444";
const portId = "55555555-5555-4555-8555-555555555555";
const cardId = "66666666-6666-4666-8666-666666666666";
const targetCardId = "99999999-9999-4999-8999-999999999999";
const connectionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const connectionTypeId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const fileId = "77777777-7777-4777-8777-777777777777";
const cardFileId = "88888888-8888-4888-8888-888888888888";
const connectionFileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const bindingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const libraryEntryId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("v2 API contracts", () => {
  const baseCardType = {
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
  } as const;

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
            ...baseCardType,
            schema: { fields: [] }
          }
        ],
        connectionTypes: [],
        cards: [],
        connections: []
      })
    ).toMatchObject({
      workspace: { id: workspaceId },
      board: { id: boardId },
      cardTypes: [{ key: "source" }],
      cardAttachmentCounts: {}
    });
  });

  it("parses empty connection type schema", () => {
    expect(v2ConnectionTypeDefinitionSchema.parse({ fields: [] })).toEqual({ fields: [] });
  });

  it("parses supported connection type field schemas", () => {
    expect(
      v2ConnectionTypeDefinitionSchema.parse({
        fields: [
          { key: "quantity", label: "Quantity", type: "number", required: true },
          { key: "unit", label: "Unit", type: "select", options: [{ value: "pcs", label: "pcs" }] },
          { key: "note", label: "Note", type: "text" },
          { key: "active", label: "Active", type: "boolean" },
          { key: "payload", label: "Payload", type: "json" },
          { key: "dueDate", label: "Due date", type: "date" }
        ]
      })
    ).toMatchObject({
      fields: [
        { key: "quantity", type: "number" },
        { key: "unit", type: "select" },
        { key: "note", type: "text" },
        { key: "active", type: "boolean" },
        { key: "payload", type: "json" },
        { key: "dueDate", type: "date" }
      ]
    });
  });

  it("rejects invalid connection type field schema", () => {
    expect(() =>
      v2ConnectionTypeDefinitionSchema.parse({
        fields: [{ key: "quantity", label: "Quantity", type: "formula" }]
      })
    ).toThrow();

    expect(() =>
      v2ConnectionTypeDefinitionSchema.parse({
        fields: [
          { key: "quantity", label: "Quantity", type: "number" },
          { key: "quantity", label: "Count", type: "number" }
        ]
      })
    ).toThrow();
  });

  it("validates quantitative connection semantics against declared fields", () => {
    expect(
      v2ConnectionTypeDefinitionSchema.parse({
        fields: [
          {
            key: "quantity",
            label: "Quantity",
            type: "number",
            required: true,
            numberConstraints: { min: 0 }
          },
          { key: "unit", label: "Unit", type: "text", required: true }
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
      })
    ).toMatchObject({ semantics: { sourceRole: "component", targetRole: "assembly" } });

    expect(() =>
      v2ConnectionTypeDefinitionSchema.parse({
        fields: [{ key: "quantity", label: "Quantity", type: "text" }],
        semantics: {
          sourceRole: "component",
          targetRole: "assembly",
          quantity: {
            valueField: "quantity",
            fixedUnitCode: "piece",
            basis: "absolute"
          }
        }
      })
    ).toThrow();
  });

  it("parses connection type entity and defaults safely", () => {
    expect(
      v2ConnectionTypeSchema.parse({
        id: connectionTypeId,
        workspaceId,
        key: "contains",
        name: "Contains",
        description: null,
        schema: {
          fields: [
            { key: "quantity", label: "Quantity", type: "number" },
            { key: "unit", label: "Unit", type: "text" },
            { key: "note", label: "Note", type: "text" }
          ]
        },
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toMatchObject({
      key: "contains",
      schema: {
        fields: [
          { key: "quantity", type: "number" },
          { key: "unit", type: "text" },
          { key: "note", type: "text" }
        ]
      },
      defaultVisualStyle: {}
    });
  });

  it("parses connection type manager create and update payloads", () => {
    const parsed = v2CreateConnectionTypeBodySchema.parse({
      key: "contains",
      name: "Contains",
      description: "Assembly containment",
      schema: {
        fields: [
          { key: "quantity", label: "Quantity", type: "number" },
          { key: "unit", label: "Unit", type: "text" },
          { key: "note", label: "Note", type: "text" }
        ]
      }
    });

    expect(parsed).toMatchObject({
      key: "contains",
      name: "Contains",
      defaultVisualStyle: {}
    });
    expect(parsed.schema.fields[0]).toMatchObject({ key: "quantity", type: "number" });

    expect(
      v2UpdateConnectionTypeBodySchema.parse({
        name: "Contains updated",
        schema: { fields: [] }
      })
    ).toEqual({
      name: "Contains updated",
      schema: { fields: [] }
    });
  });

  it("parses empty card type schema", () => {
    expect(v2CardTypeDefinitionSchema.parse({ fields: [] })).toEqual({ fields: [] });
  });

  it("parses supported card type field schema types", () => {
    expect(
      v2CardTypeDefinitionSchema.parse({
        fields: [
          { key: "name", label: "Name", type: "text", required: true },
          { key: "amount", label: "Amount", type: "number" },
          { key: "active", label: "Active", type: "boolean" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "draft", label: "Draft" },
              { value: "ready", label: "Ready" }
            ]
          },
          { key: "payload", label: "Payload", type: "json" },
          { key: "dueDate", label: "Due date", type: "date" }
        ]
      })
    ).toMatchObject({
      fields: [
        { key: "name", type: "text" },
        { key: "amount", type: "number" },
        { key: "active", type: "boolean" },
        { key: "status", type: "select" },
        { key: "payload", type: "json" },
        { key: "dueDate", type: "date" }
      ]
    });
  });

  it("defaults card type field labels from keys", () => {
    expect(
      v2CardTypeDefinitionSchema.parse({
        fields: [{ key: "name", type: "text" }]
      })
    ).toEqual({
      fields: [{ key: "name", label: "name", type: "text" }]
    });
  });

  it("rejects invalid card type field schema", () => {
    expect(() =>
      v2CardTypeDefinitionSchema.parse({
        fields: [{ key: "name", label: "Name", type: "formula" }]
      })
    ).toThrow();

    expect(() =>
      v2CardTypeDefinitionSchema.parse({
        fields: [{ key: "", label: "Name", type: "text" }]
      })
    ).toThrow();
  });

  it("rejects duplicate card type field keys", () => {
    expect(() =>
      v2CardTypeDefinitionSchema.parse({
        fields: [
          { key: "name", label: "Name", type: "text" },
          { key: "name", label: "Display name", type: "text" }
        ]
      })
    ).toThrow();
  });

  it("parses card type schema on V2CardType and defaults missing schema", () => {
    expect(
      v2CardTypeEntitySchema.parse({
        ...baseCardType,
        schema: {
          fields: [{ key: "name", label: "Name", type: "text" }]
        }
      })
    ).toMatchObject({
      schema: { fields: [{ key: "name", label: "Name", type: "text" }] }
    });

    expect(v2CardTypeEntitySchema.parse(baseCardType)).toMatchObject({
      schema: { fields: [] },
      defaultVisualStyle: {}
    });
  });

  it("parses card type visual defaults", () => {
    expect(
      v2CardTypeEntitySchema.parse({
        ...baseCardType,
        defaultVisualStyle: {
          accentKey: "blue",
          accentColor: "#2383ff",
          iconKey: "database",
          fillColor: "#ffffff"
        }
      })
    ).toMatchObject({
      defaultVisualStyle: {
        accentKey: "blue",
        accentColor: "#2383ff",
        iconKey: "database",
        fillColor: "#ffffff"
      }
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

  it("accepts linked card creation without duplicated semantic content", () => {
    expect(
      v2CreateCardBodySchema.parse({
        cardTypeId,
        libraryEntryId,
        position: { x: 20, y: 40 }
      })
    ).toEqual({ cardTypeId, libraryEntryId, position: { x: 20, y: 40 } });

    expect(() =>
      v2CreateCardBodySchema.parse({
        cardTypeId,
        libraryEntryId,
        data: { taxId: "7701001001" }
      })
    ).toThrow();
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

  it("accepts connection metadata fields", () => {
    expect(
      v2ConnectionSchema.parse({
        id: connectionId,
        workspaceId,
        boardId,
        connectionTypeId,
        sourceCardId: cardId,
        targetCardId,
        sourcePortKey: "payload",
        targetPortKey: "input",
        title: "Payload route",
        description: "Transfers normalized payloads",
        data: { payload: "json", priority: 2 },
        visualStyle: {
          strokeColor: "#2563eb",
          strokeWidth: 3,
          cornerRadius: 12,
          markerStart: "none",
          markerEnd: "arrow"
        },
        type: "data",
        label: "payload",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toMatchObject({
      connectionTypeId,
      title: "Payload route",
      description: "Transfers normalized payloads",
      data: { payload: "json", priority: 2 },
      visualStyle: {
        strokeColor: "#2563eb",
        strokeWidth: 3,
        cornerRadius: 12,
        markerStart: "none",
        markerEnd: "arrow"
      }
    });
  });

  it("defaults nullable connection metadata", () => {
    expect(
      v2ConnectionSchema.parse({
        id: connectionId,
        workspaceId,
        boardId,
        sourceCardId: cardId,
        targetCardId,
        sourcePortKey: "payload",
        targetPortKey: "input",
        type: "data",
        label: "",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toMatchObject({
      connectionTypeId: null,
      title: null,
      description: null,
      data: {},
      visualStyle: {}
    });
  });

  it("accepts connection visual style updates", () => {
    expect(
      v2UpdateConnectionBodySchema.parse({
        visualStyle: {
          strokeColor: "#2563eb",
          strokeWidth: 4,
          cornerRadius: 16,
          markerStart: "circle",
          markerEnd: "arrow"
        }
      })
    ).toEqual({
      visualStyle: {
        strokeColor: "#2563eb",
        strokeWidth: 4,
        cornerRadius: 16,
        markerStart: "circle",
        markerEnd: "arrow"
      }
    });
  });

  it("accepts connector slot labels as visual metadata", () => {
    expect(
      v2CardVisualStyleSchema.parse({
        connectorSlots: [
          {
            id: "slot-output",
            type: "output",
            side: "right",
            offset: 0.5,
            label: "Approved orders",
            showLabel: true
          },
          {
            id: "slot-input",
            type: "input",
            side: "left",
            offset: 0.5,
            label: "",
            showLabel: false
          }
        ]
      })
    ).toEqual({
      connectorSlots: [
        {
          id: "slot-output",
          type: "output",
          side: "right",
          offset: 0.5,
          label: "Approved orders",
          showLabel: true
        },
        {
          id: "slot-input",
          type: "input",
          side: "left",
          offset: 0.5,
          label: "",
          showLabel: false
        }
      ]
    });
  });

  it("accepts connection endpoint retarget updates", () => {
    expect(
      v2UpdateConnectionBodySchema.parse({
        sourceCardId: cardId,
        targetCardId,
        connectionTypeId,
        sourcePortKey: "payload",
        targetPortKey: "input"
      })
    ).toEqual({
      sourceCardId: cardId,
      targetCardId,
      connectionTypeId,
      sourcePortKey: "payload",
      targetPortKey: "input"
    });

    expect(() =>
      v2UpdateConnectionBodySchema.parse({
        sourcePortKey: ""
      })
    ).toThrow();
  });

  it("rejects non-object connection data", () => {
    expect(() =>
      v2UpdateConnectionBodySchema.parse({
        data: ["not", "object"]
      })
    ).toThrow();
  });

  it("keeps route contracts in an OpenAPI-style registry", () => {
    expect(v2ApiContracts.getBoard).toMatchObject({
      method: "GET",
      path: "/v2/boards/{boardId}"
    });
    expect(v2ApiContracts.createCard.body).toBe(v2CreateCardBodySchema);
    expect(v2ApiContracts.updateCard.body).toBe(v2UpdateCardBodySchema);
    expect(v2ApiContracts.updateConnection.body).toBe(v2UpdateConnectionBodySchema);
    expect(v2ApiContracts.createCardType.body).toBe(v2CreateCardTypeBodySchema);
    expect(v2ApiContracts.updateCardType.body).toBe(v2UpdateCardTypeBodySchema);
    expect(v2ApiContracts.updateCardTypeSchema.body).toBe(v2UpdateCardTypeSchemaBodySchema);
    expect(v2ApiContracts.listCardLibraryEntries).toMatchObject({
      method: "GET",
      path: "/v2/workspaces/{workspaceId}/card-types/{cardTypeId}/library-entries"
    });
    expect(v2ApiContracts.createCardLibraryEntry.body).toBe(
      v2CreateCardLibraryEntryBodySchema
    );
    expect(v2ApiContracts.updateCardLibraryEntry.body).toBe(
      v2UpdateCardLibraryEntryBodySchema
    );
    expect(v2ApiContracts.setCardLibraryEntry.body).toBe(v2SetCardLibraryEntryBodySchema);
    expect(v2ApiContracts.runBoardDryRun.body).toBe(v2RunDryRunBodySchema);
    expect(v2ApiContracts.createLinkedFieldBinding.body).toBe(v2CreateLinkedFieldBindingBodySchema);
    expect(v2ApiContracts.updateLinkedFieldBinding.body).toBe(v2UpdateLinkedFieldBindingBodySchema);
    expect(v2ApiContracts.updateBoardLayout.body).toBe(v2UpdateBoardLayoutBodySchema);
  });

  it("validates atomic board layout batches", () => {
    expect(
      v2UpdateBoardLayoutBodySchema.parse({
        cards: [{ id: cardId, position: { x: 120, y: 240 } }],
        connections: [
          {
            id: connectionId,
            visualStyle: {
              routeMode: "manual",
              waypoints: [{ x: 300, y: 240 }],
              labelPosition: { x: 320, y: 220 }
            }
          }
        ]
      })
    ).toMatchObject({ cards: [{ id: cardId }], connections: [{ id: connectionId }] });

    expect(
      v2UpdateBoardLayoutBodySchema.parse({
        cards: [
          { id: cardId, zIndex: 2 },
          { id: cardTypeId, zIndex: 1 }
        ]
      })
    ).toMatchObject({
      cards: [
        { id: cardId, zIndex: 2 },
        { id: cardTypeId, zIndex: 1 }
      ]
    });

    expect(() => v2UpdateBoardLayoutBodySchema.parse({})).toThrow();
    expect(() =>
      v2UpdateBoardLayoutBodySchema.parse({ cards: [{ id: cardId }] })
    ).toThrow();
  });

  it("parses card type create and update requests", () => {
    expect(
      v2CreateCardTypeBodySchema.parse({
        key: "supplier",
        name: "Supplier",
        description: "Provides parts",
        defaultSize: { width: 320, height: 180 },
        defaultVisualStyle: {
          accentKey: "green",
          iconKey: "database"
        },
        ports: [
          { key: "input", label: "Input", direction: "input" },
          { key: "output", label: "Output", direction: "output" }
        ],
        schema: {
          fields: [{ key: "phone", label: "Phone", type: "text" }]
        }
      })
    ).toEqual({
      key: "supplier",
      name: "Supplier",
      description: "Provides parts",
      defaultSize: { width: 320, height: 180 },
      defaultVisualStyle: {
        accentKey: "green",
        iconKey: "database"
      },
      ports: [
        { key: "input", label: "Input", direction: "input", dataType: "json", required: false, sortOrder: 0 },
        { key: "output", label: "Output", direction: "output", dataType: "json", required: false, sortOrder: 0 }
      ],
      schema: {
        fields: [{ key: "phone", label: "Phone", type: "text" }]
      }
    });

    expect(
      v2CreateCardTypeBodySchema.parse({
        key: "layered_supplier",
        name: "Layered supplier",
        defaultVisualStyle: { zIndex: 4 }
      }).defaultVisualStyle
    ).toEqual({});

    expect(
      v2UpdateCardTypeBodySchema.parse({
        name: "Updated supplier",
        defaultSize: { width: 340, height: 190 },
        defaultVisualStyle: { accentKey: "orange", iconKey: "truck" },
        ports: [{ key: "output", label: "Output", direction: "output" }],
        schema: { fields: [{ key: "rating", label: "Rating", type: "number" }] }
      })
    ).toEqual({
      name: "Updated supplier",
      defaultSize: { width: 340, height: 190 },
      defaultVisualStyle: { accentKey: "orange", iconKey: "truck" },
      ports: [{ key: "output", label: "Output", direction: "output", dataType: "json", required: false, sortOrder: 0 }],
      schema: { fields: [{ key: "rating", label: "Rating", type: "number" }] }
    });

    expect(() => v2CreateCardTypeBodySchema.parse({ key: "", name: "Bad" })).toThrow();
    expect(() => v2CreateCardTypeBodySchema.parse({ key: "BadKey", name: "Bad" })).toThrow();
    expect(() => v2CreateCardTypeBodySchema.parse({ key: "supplier", name: "" })).toThrow();
  });

  it("parses card type schema update requests", () => {
    expect(
      v2UpdateCardTypeSchemaBodySchema.parse({
        schema: {
          fields: [{ key: "phone", label: "Phone", type: "text" }]
        }
      })
    ).toEqual({
      schema: {
        fields: [{ key: "phone", label: "Phone", type: "text" }]
      }
    });

    expect(() =>
      v2UpdateCardTypeSchemaBodySchema.parse({
        schema: {
          fields: [
            { key: "phone", label: "Phone", type: "text" },
            { key: "phone", label: "Duplicate", type: "text" }
          ]
        }
      })
    ).toThrow();
  });

  it("parses card library entries and derives whether they can be selected", () => {
    const activeEntry = v2CardLibraryEntrySchema.parse({
      id: libraryEntryId,
      workspaceId,
      cardTypeId,
      title: "Northwind",
      description: "Primary supplier",
      data: { taxId: "7701001001", rating: 5 },
      version: 3,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(activeEntry).toMatchObject({
      archivedAt: null,
      validationIssues: [],
      selectable: true,
      usageCount: 0
    });

    expect(
      v2CardLibraryEntrySchema.parse({
        ...activeEntry,
        archivedAt: timestamp,
        selectable: undefined
      })
    ).toMatchObject({ selectable: false });

    expect(
      v2CardLibraryEntrySchema.parse({
        ...activeEntry,
        validationIssues: [
          { code: "required", fieldKey: "taxId", message: "Tax ID is required" }
        ],
        selectable: undefined
      })
    ).toMatchObject({ selectable: false });
  });

  it("parses card library list queries and response pages", () => {
    expect(v2ListCardLibraryEntriesQuerySchema.parse({ limit: "25" })).toEqual({
      status: "active",
      limit: 25,
      sort: "title",
      direction: "asc"
    });
    expect(() => v2ListCardLibraryEntriesQuerySchema.parse({ limit: 101 })).toThrow();

    expect(
      v2CardLibraryEntryListResponseSchema.parse({
        entries: [
          {
            id: libraryEntryId,
            workspaceId,
            cardTypeId,
            title: "Northwind",
            description: "",
            data: {},
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        nextCursor: null
      })
    ).toMatchObject({ entries: [{ id: libraryEntryId, selectable: true }], nextCursor: null });
  });

  it("validates card library create, update, delete, and binding requests", () => {
    expect(v2CreateCardLibraryEntryBodySchema.parse({ title: "  Northwind  " })).toEqual({
      title: "Northwind",
      description: "",
      data: {}
    });
    expect(() =>
      v2CreateCardLibraryEntryBodySchema.parse({
        title: "Unsafe",
        data: { _yadraw: { libraryEntryId } }
      })
    ).toThrow();

    expect(
      v2UpdateCardLibraryEntryBodySchema.parse({
        archived: true,
        expectedVersion: 3
      })
    ).toEqual({ archived: true, expectedVersion: 3 });
    expect(() =>
      v2UpdateCardLibraryEntryBodySchema.parse({ expectedVersion: 3 })
    ).toThrow();
    expect(v2DeleteCardLibraryEntryQuerySchema.parse({ expectedVersion: "3" })).toEqual({
      expectedVersion: 3
    });

    expect(
      v2SetCardLibraryEntryBodySchema.parse({
        libraryEntryId,
        expectedLibraryEntryId: null
      })
    ).toEqual({ libraryEntryId, expectedLibraryEntryId: null });
    expect(
      v2SetCardLibraryEntryBodySchema.parse({
        libraryEntryId: null,
        expectedLibraryEntryId: libraryEntryId
      })
    ).toEqual({ libraryEntryId: null, expectedLibraryEntryId: libraryEntryId });
    expect(() =>
      v2SetCardLibraryEntryBodySchema.parse({ libraryEntryId })
    ).toThrow();
  });

  it("parses dry-run requests and results", () => {
    expect(v2RunDryRunBodySchema.parse({ startCardId: cardId })).toEqual({ startCardId: cardId });
    expect(v2RunDryRunBodySchema.parse({})).toEqual({});

    expect(
      v2DryRunResultSchema.parse({
        ok: true,
        mode: "dry-run",
        boardId,
        startCardId: cardId,
        steps: [
          {
            cardId,
            title: "Source",
            type: "source",
            status: "would_run",
            message: "Would process this card"
          }
        ],
        warnings: []
      })
    ).toMatchObject({
      mode: "dry-run",
      steps: [{ status: "would_run" }]
    });
  });

  it("parses generic linked field bindings", () => {
    const binding = v2LinkedFieldBindingSchema.parse({
      id: bindingId,
      workspaceId,
      boardId,
      targetCardId,
      targetField: "supplierPhone",
      sourceMode: "connectedCard",
      direction: "incoming",
      sourceCardId: null,
      sourceCardTypeId: cardTypeId,
      sourceCardTypeKey: "source",
      sourceFieldPath: "data.phone",
      onMissing: "empty",
      onMultiple: "warning",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(binding).toMatchObject({
      targetField: "supplierPhone",
      sourceFieldPath: "data.phone",
      sourceMode: "connectedCard"
    });

    expect(
      v2LinkedFieldBindingListResponseSchema.parse({ fieldBindings: [binding] })
    ).toMatchObject({
      fieldBindings: [{ id: bindingId }]
    });
  });

  it("accepts arbitrary supported source field paths for linked bindings", () => {
    expect(
      v2CreateLinkedFieldBindingBodySchema.parse({
        targetCardId,
        targetField: "assigneeName",
        sourceMode: "exactCard",
        direction: "incoming",
        sourceCardId: cardId,
        sourceFieldPath: "title"
      })
    ).toMatchObject({
      targetField: "assigneeName",
      sourceFieldPath: "title",
      onMissing: "empty",
      onMultiple: "warning"
    });

    expect(
      v2UpdateLinkedFieldBindingBodySchema.parse({
        targetField: "customerCity",
        sourceFieldPath: "data.address.city"
      })
    ).toEqual({
      targetField: "customerCity",
      sourceFieldPath: "data.address.city"
    });
  });

  it("rejects empty linked field targets and source paths", () => {
    expect(() =>
      v2CreateLinkedFieldBindingBodySchema.parse({
        targetCardId,
        targetField: "",
        sourceMode: "connectedCard",
        direction: "incoming",
        sourceFieldPath: "data.phone"
      })
    ).toThrow();

    expect(() =>
      v2CreateLinkedFieldBindingBodySchema.parse({
        targetCardId,
        targetField: "supplierPhone",
        sourceMode: "connectedCard",
        direction: "incoming",
        sourceFieldPath: ""
      })
    ).toThrow();
  });
});

describe("v2ConnectionVisualStyleSchema", () => {
  it("accepts empty visual style", () => {
    expect(v2ConnectionVisualStyleSchema.parse({})).toEqual({});
  });

  it("accepts valid color, width, radius, and markers", () => {
    expect(
      v2ConnectionVisualStyleSchema.parse({
        strokeColor: "#2563eb",
        strokeWidth: 3,
        cornerRadius: 12,
        markerStart: "none",
        markerEnd: "arrow"
      })
    ).toEqual({
      strokeColor: "#2563eb",
      strokeWidth: 3,
      cornerRadius: 12,
      markerStart: "none",
      markerEnd: "arrow"
    });
    expect(v2ConnectionVisualStyleSchema.parse({ markerEnd: "ring" })).toEqual({
      markerEnd: "ring"
    });
  });

  it("accepts automatic and manual connector routes", () => {
    expect(
      v2ConnectionVisualStyleSchema.parse({
        routeMode: "auto",
        waypoints: [],
        labelPosition: null,
        labelSegmentIndex: null
      })
    ).toEqual({
      routeMode: "auto",
      waypoints: [],
      labelPosition: null,
      labelSegmentIndex: null
    });

    expect(
      v2ConnectionVisualStyleSchema.parse({
        routeMode: "manual",
        waypoints: [
          { x: 120, y: 80 },
          { x: 180, y: 160 }
        ],
        labelPosition: { x: 150, y: 120 },
        labelSegmentIndex: 1
      })
    ).toEqual({
      routeMode: "manual",
      waypoints: [
        { x: 120, y: 80 },
        { x: 180, y: 160 }
      ],
      labelPosition: { x: 150, y: 120 },
      labelSegmentIndex: 1
    });
  });

  it("rejects invalid marker values", () => {
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ markerEnd: "diamond" })
    ).toThrow();
  });

  it("rejects invalid route geometry", () => {
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ routeMode: "curved" })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({
        routeMode: "manual",
        waypoints: [{ x: Number.NaN, y: 10 }]
      })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({
        routeMode: "manual",
        waypoints: [{ x: Number.POSITIVE_INFINITY, y: 10 }]
      })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({
        routeMode: "manual",
        waypoints: Array.from({ length: 21 }, (_, index) => ({ x: index, y: index }))
      })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({
        labelPosition: { x: 10, y: Number.NEGATIVE_INFINITY }
      })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({
        labelSegmentIndex: -1
      })
    ).toThrow();
  });

  it("rejects invalid width and radius", () => {
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ strokeWidth: 0 })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ strokeWidth: 13 })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ cornerRadius: -1 })
    ).toThrow();
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ cornerRadius: 49 })
    ).toThrow();
  });

  it("rejects non-hex stroke colors", () => {
    expect(() =>
      v2ConnectionVisualStyleSchema.parse({ strokeColor: "red" })
    ).toThrow();
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
        textDecoration: "underline",
        locked: true
      })
    ).toEqual({
      fontFamily: "Inter",
      textAlign: "center",
      textColor: "#111827",
      fontWeight: "700",
      fontStyle: "italic",
      textDecoration: "underline",
      locked: true
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
    expect(card).not.toHaveProperty("connection");
    expect(card.data).toEqual({ key: "value" });
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
        textDecoration: "underline",
        zIndex: 4
      }
    });
    expect(card.visualStyle).toEqual({
      fontFamily: "Mono",
      textAlign: "left",
      textColor: "#333",
      fontWeight: "700",
      fontStyle: "italic",
      textDecoration: "underline",
      zIndex: 4
    });
  });

  it("accepts a library entry reference outside card data", () => {
    const card = v2CardSchema.parse({
      ...baseCard,
      libraryEntryId
    });
    expect(card.libraryEntryId).toBe(libraryEntryId);
    expect(card.data).toEqual({ key: "value" });
    expect(() =>
      v2CardSchema.parse({ ...baseCard, libraryEntryId: "not-a-uuid" })
    ).toThrow();
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

  it("accepts a valid connection-file link", () => {
    expect(
      v2ConnectionFileSchema.parse({
        id: connectionFileId,
        workspaceId,
        connectionId,
        fileId,
        role: "attachment",
        metadata: { source: "connector" },
        file: baseFile,
        createdBy: null,
        createdAt: timestamp,
        deletedAt: null
      })
    ).toMatchObject({
      id: connectionFileId,
      connectionId,
      fileId,
      role: "attachment"
    });
  });

  it("rejects invalid connection-file metadata", () => {
    expect(() =>
      v2ConnectionFileSchema.parse({
        id: connectionFileId,
        workspaceId,
        connectionId,
        fileId,
        role: "attachment",
        metadata: ["not", "object"],
        createdAt: timestamp
      })
    ).toThrow();
  });

  it("accepts a compact connection attachment", () => {
    expect(
      v2ConnectionAttachmentSchema.parse({
        id: connectionFileId,
        connectionId,
        fileId,
        role: "attachment",
        metadata: { source: "connector" },
        filename: "bearing.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        sha256: "abc123",
        processingStatus: "processed",
        createdAt: timestamp
      })
    ).toMatchObject({
      filename: "bearing.pdf",
      sha256: "abc123",
      processingStatus: "processed"
    });
  });

  it("rejects negative sizeBytes in compact connection attachment", () => {
    expect(() =>
      v2ConnectionAttachmentSchema.parse({
        id: connectionFileId,
        connectionId,
        fileId,
        role: "attachment",
        metadata: {},
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

describe("v2 dashboard and auth contracts", () => {
  it("normalizes the verified Supabase profile", () => {
    expect(
      v2BootstrapSessionBodySchema.parse({
        email: " User@Example.com ",
        name: "User",
        avatarUrl: null,
        authProvider: "supabase"
      })
    ).toEqual({
      email: "user@example.com",
      name: "User",
      avatarUrl: null,
      authProvider: "supabase"
    });
  });

  it("rejects unknown board creation fields", () => {
    expect(() => v2CreateBoardBodySchema.parse({ name: "Board", userId: cardId })).toThrow();
  });

  it("accepts a personal bootstrap response", () => {
    expect(() =>
      v2BootstrapSessionResponseSchema.parse({
        created: true,
        user: { id: cardId, email: "user@example.com", name: "User", avatarUrl: null },
        workspace: {
          id: workspaceId,
          name: "User's workspace",
          slug: "personal-6666666666664666",
          role: "owner",
          updatedAt: timestamp
        },
        board: { id: boardId, workspaceId, name: "Demo board", updatedAt: timestamp }
      })
    ).not.toThrow();
  });
});

