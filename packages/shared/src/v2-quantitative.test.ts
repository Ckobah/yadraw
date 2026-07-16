import { describe, expect, it } from "vitest";
import type { V2BoardDetail, V2ConnectionType } from "./v2.js";
import {
  buildV2ConnectionDefaultData,
  buildV2RelationshipStatement,
  buildV2SemanticGraph,
  evaluateV2QuantitativeGraph,
  getV2ConnectionSemanticLabel,
  getV2RelationshipGuidance,
  validateV2ConnectionData
} from "./v2-quantitative.js";

const timestamp = "2026-07-13T12:00:00.000Z";
const workspaceId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const boardId = "33333333-3333-4333-8333-333333333333";
const componentId = "44444444-4444-4444-8444-444444444444";
const assemblyId = "55555555-5555-4555-8555-555555555555";
const cardTypeId = "66666666-6666-4666-8666-666666666666";
const connectionTypeId = "77777777-7777-4777-8777-777777777777";
const connectionId = "88888888-8888-4888-8888-888888888888";

const containsType: V2ConnectionType = {
  id: connectionTypeId,
  workspaceId,
  key: "contains",
  name: "Contains",
  description: "Bill of materials relationship",
  schema: {
    fields: [
      {
        key: "quantity",
        label: "Quantity",
        type: "number",
        required: true,
        defaultValue: 1,
        numberConstraints: { min: 0, integer: true }
      },
      {
        key: "unit",
        label: "Unit",
        type: "select",
        required: true,
        defaultValue: "piece",
        options: [{ value: "piece", label: "Pieces" }]
      }
    ],
    semantics: {
      version: 1,
      kind: "contains",
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
  defaultVisualStyle: {},
  createdAt: timestamp,
  updatedAt: timestamp
};

function boardDetail(status: "draft" | "active" = "active"): V2BoardDetail {
  return {
    workspace: {
      id: workspaceId,
      name: "Workspace",
      slug: "workspace",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    project: {
      id: projectId,
      workspaceId,
      name: "Project",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    board: {
      id: boardId,
      workspaceId,
      projectId,
      name: "Board",
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: timestamp,
      updatedAt: timestamp
    },
    cardTypes: [{
      id: cardTypeId,
      workspaceId,
      key: "item",
      name: "Item",
      description: "",
      schema: { fields: [] },
      defaultData: {},
      defaultSize: { width: 300, height: 180 },
      defaultVisualStyle: {},
      ports: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }],
    connectionTypes: [containsType],
    cards: [
      {
        id: componentId,
        workspaceId,
        boardId,
        cardTypeId,
        title: "Bolt",
        description: "",
        data: {},
        position: { x: 0, y: 0 },
        size: { width: 300, height: 180 },
        visualStyle: {},
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: assemblyId,
        workspaceId,
        boardId,
        cardTypeId,
        title: "Bracket assembly",
        description: "",
        data: { plannedQuantity: 3 },
        position: { x: 400, y: 0 },
        size: { width: 300, height: 180 },
        visualStyle: {},
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    cardAttachmentCounts: {},
    connections: [{
      id: connectionId,
      workspaceId,
      boardId,
      connectionTypeId,
      sourceCardId: componentId,
      targetCardId: assemblyId,
      sourcePortKey: "output",
      targetPortKey: "input",
      title: "Contains ABC",
      description: null,
      data: { quantity: 5, unit: "piece" },
      visualStyle: {},
      type: "data",
      label: "",
      status,
      createdAt: timestamp,
      updatedAt: timestamp
    }]
  };
}

describe("V2 quantitative relationships", () => {
  it("builds defaults and validates numeric constraints", () => {
    expect(buildV2ConnectionDefaultData(containsType)).toEqual({ quantity: 1, unit: "piece" });
    expect(validateV2ConnectionData(containsType, { quantity: 2, unit: "piece" }).validity).toBe("valid");
    expect(validateV2ConnectionData(containsType, { quantity: 2.5, unit: "piece" })).toMatchObject({
      validity: "invalid",
      issues: [{ code: "not_integer" }]
    });
  });

  it("prioritizes semantic quantity in the connector label", () => {
    const connection = boardDetail().connections[0]!;
    expect(getV2ConnectionSemanticLabel(connection, containsType)).toBe("5 pcs / assembly");
    expect(getV2ConnectionSemanticLabel(connection, containsType, {
      id: `required:${connectionId}`,
      metric: "required_quantity",
      sourceCardId: componentId,
      targetCardId: assemblyId,
      connectionId,
      value: 15,
      unitCode: "piece",
      formulaId: "bom.required.v1",
      explanation: "5 pcs per Bracket assembly × 3 = 15 pcs",
      inputs: [{
        kind: "connection_field",
        id: connectionId,
        path: "data.quantity",
        value: 5
      }]
    })).toBe("5 pcs each · 15 pcs total");
    expect(buildV2RelationshipStatement("Bolt", "Bracket", containsType)).toBe(
      "Bolt is part of Bracket"
    );
    expect(buildV2RelationshipStatement("Steel", "Table", {
      ...containsType,
      key: "needs",
      schema: {
        ...containsType.schema,
        semantics: {
          ...containsType.schema.semantics!,
          kind: "needs"
        }
      }
    })).toBe("Table needs Steel");
    expect(buildV2RelationshipStatement("Factory", "Table", {
      ...containsType,
      key: "produces",
      schema: {
        fields: [],
        semantics: {
          version: 1,
          kind: "produces",
          sourceRole: "producer",
          targetRole: "product"
        }
      }
    })).toBe("Factory produces Table");
  });

  it("evaluates per-target requirements with explicit provenance and totals", () => {
    const evaluation = evaluateV2QuantitativeGraph(boardDetail(), {
      graphRevision: "sha256:test",
      computedAt: timestamp
    });

    expect(evaluation.results).toEqual([
      expect.objectContaining({
        sourceCardId: componentId,
        targetCardId: assemblyId,
        value: 15,
        unitCode: "piece",
        formulaId: "bom.required.v1",
        explanation: "5 pcs per Bracket assembly × 3 = 15 pcs",
        inputs: expect.arrayContaining([
          expect.objectContaining({ kind: "connection_field", value: 5 }),
          expect.objectContaining({ kind: "card_field", value: 3 })
        ])
      })
    ]);
    expect(evaluation.totals).toEqual([
      expect.objectContaining({ cardId: componentId, value: 15, unitCode: "piece" })
    ]);

    const scenario = evaluateV2QuantitativeGraph(boardDetail(), {
      graphRevision: "sha256:test",
      computedAt: timestamp,
      overrides: [{ cardId: assemblyId, patch: { plannedQuantity: 4 } }]
    });
    expect(scenario.results[0]?.value).toBe(20);
    expect(scenario.results[0]?.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "override", value: 4 })
    ]));

    const defaultsDetail = boardDetail();
    defaultsDetail.connections[0]!.data = {};
    const defaultsEvaluation = evaluateV2QuantitativeGraph(defaultsDetail, {
      graphRevision: "sha256:test",
      computedAt: timestamp
    });
    expect(defaultsEvaluation.results[0]).toMatchObject({ value: 3, unitCode: "piece" });
    expect(defaultsEvaluation.results[0]?.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "default", path: "data.quantity", value: 1 }),
      expect.objectContaining({ kind: "default", path: "data.unit", value: "piece" })
    ]));
  });

  it("excludes draft relationships and exposes semantic roles for API consumers", () => {
    const detail = boardDetail("draft");
    const evaluation = evaluateV2QuantitativeGraph(detail, {
      graphRevision: "sha256:test",
      computedAt: timestamp
    });
    const graph = buildV2SemanticGraph(detail, "sha256:test", timestamp);

    expect(evaluation.results).toEqual([]);
    expect(evaluation.warnings).toEqual([
      expect.objectContaining({ code: "draft_quantitative_connection", connectionId })
    ]);
    expect(graph.relations[0]).toMatchObject({
      predicate: "contains",
      kind: "contains",
      statement: "Bolt is part of Bracket assembly",
      source: { cardId: componentId, role: "component" },
      target: { cardId: assemblyId, role: "assembly" },
      quantity: { value: 5, unitCode: "piece", basis: "per_target" }
    });
    expect(getV2ConnectionSemanticLabel(detail.connections[0]!, containsType)).toBe("Needs attention");
    expect(getV2RelationshipGuidance(detail.connections[0]!, containsType)).toBe(
      "Complete the relationship details to include it in totals."
    );
  });
});
