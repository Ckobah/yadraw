import { describe, expect, it } from "vitest";
import { parsePortEntry, parseYadrawPorts, legacyCardFromRow } from "./repository.legacy-postgres.js";

const cardTypeId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const ts = "2026-01-01T00:00:00.000Z";

describe("parsePortEntry", () => {
  it("parses a simple string entry", () => {
    const port = parsePortEntry("payload", "input", cardTypeId, workspaceId, 0, ts);
    expect(port).not.toBeNull();
    expect(port).toMatchObject({
      key: "payload",
      label: "payload",
      direction: "input",
      dataType: "json",
      sortOrder: 0,
    });
  });

  it("parses an object entry with key, label, dataType, required", () => {
    const port = parsePortEntry(
      { key: "embedding", label: "Embedding", dataType: "vector", required: true },
      "output",
      cardTypeId,
      workspaceId,
      1,
      ts
    );
    expect(port).not.toBeNull();
    expect(port).toMatchObject({
      key: "embedding",
      label: "Embedding",
      direction: "output",
      dataType: "vector",
      required: true,
      sortOrder: 1,
    });
  });

  it("falls back to id or name for key", () => {
    const byId = parsePortEntry({ id: "customer_id" }, "input", cardTypeId, workspaceId, 0, ts);
    expect(byId?.key).toBe("customer_id");

    const byName = parsePortEntry({ name: "order_item" }, "output", cardTypeId, workspaceId, 1, ts);
    expect(byName?.key).toBe("order_item");
  });

  it("falls back to name or title for label", () => {
    const byName = parsePortEntry({ key: "addr", name: "Address" }, "input", cardTypeId, workspaceId, 0, ts);
    expect(byName?.label).toBe("Address");

    const byTitle = parsePortEntry({ key: "cat", title: "Category" }, "output", cardTypeId, workspaceId, 1, ts);
    expect(byTitle?.label).toBe("Category");
  });

  it("rejects invalid key format", () => {
    expect(parsePortEntry("UPPERCASE", "input", cardTypeId, workspaceId, 0, ts)).toBeNull();
    expect(parsePortEntry("has spaces", "output", cardTypeId, workspaceId, 0, ts)).toBeNull();
    expect(parsePortEntry("", "input", cardTypeId, workspaceId, 0, ts)).toBeNull();
  });

  it("rejects object with no valid key", () => {
    expect(parsePortEntry({ label: "No Key" }, "input", cardTypeId, workspaceId, 0, ts)).toBeNull();
  });

  it("defaults required based on direction", () => {
    const inputPort = parsePortEntry("data", "input", cardTypeId, workspaceId, 0, ts);
    expect(inputPort?.required).toBe(true);

    const outputPort = parsePortEntry("result", "output", cardTypeId, workspaceId, 0, ts);
    expect(outputPort?.required).toBe(false);
  });

  it("respects explicit required value", () => {
    const required = parsePortEntry(
      { key: "opt", required: true },
      "output",
      cardTypeId,
      workspaceId,
      0,
      ts
    );
    expect(required?.required).toBe(true);

    const optional = parsePortEntry(
      { key: "opt", required: false },
      "input",
      cardTypeId,
      workspaceId,
      0,
      ts
    );
    expect(optional?.required).toBe(false);
  });
});

describe("parseYadrawPorts", () => {
  it("parses array-of-strings format (v1 common)", () => {
    const ports = parseYadrawPorts(
      { inputs: ["customer", "order"], outputs: ["order_id"] },
      cardTypeId,
      workspaceId,
      ts
    );
    expect(ports).toHaveLength(3);
    expect(ports[0]).toMatchObject({ key: "customer", direction: "input", sortOrder: 0 });
    expect(ports[1]).toMatchObject({ key: "order", direction: "input", sortOrder: 1 });
    expect(ports[2]).toMatchObject({ key: "order_id", direction: "output", sortOrder: 2 });
  });

  it("parses array-of-objects format", () => {
    const ports = parseYadrawPorts(
      {
        inputs: [{ key: "payload", label: "Payload", dataType: "json" }],
        outputs: [{ key: "result", label: "Result", dataType: "string" }],
      },
      cardTypeId,
      workspaceId,
      ts
    );
    expect(ports).toHaveLength(2);
    expect(ports[0]).toMatchObject({ key: "payload", direction: "input", dataType: "json" });
    expect(ports[1]).toMatchObject({ key: "result", direction: "output", dataType: "string" });
  });

  it("parses object-map format", () => {
    const ports = parseYadrawPorts(
      {
        inputs: { record: { label: "Record", dataType: "json" } },
        outputs: { saved: { label: "Saved" } },
      },
      cardTypeId,
      workspaceId,
      ts
    );
    expect(ports).toHaveLength(2);
    expect(ports[0]).toMatchObject({ key: "record", direction: "input" });
    expect(ports[1]).toMatchObject({ key: "saved", direction: "output" });
  });

  it("returns empty array for missing yadraw", () => {
    expect(parseYadrawPorts(null, cardTypeId, workspaceId, ts)).toHaveLength(0);
    expect(parseYadrawPorts(undefined, cardTypeId, workspaceId, ts)).toHaveLength(0);
    expect(parseYadrawPorts({}, cardTypeId, workspaceId, ts)).toHaveLength(0);
  });

  it("returns empty array when inputs/outputs are missing", () => {
    expect(parseYadrawPorts({ typeKey: "trigger" }, cardTypeId, workspaceId, ts)).toHaveLength(0);
  });

  it("returns empty array for empty inputs/outputs", () => {
    const ports = parseYadrawPorts(
      { inputs: [], outputs: [] },
      cardTypeId,
      workspaceId,
      ts
    );
    expect(ports).toHaveLength(0);
  });

  it("handles invalid values gracefully", () => {
    const ports = parseYadrawPorts(
      { inputs: "not-an-array", outputs: 42 },
      cardTypeId,
      workspaceId,
      ts
    );
    expect(ports).toHaveLength(0);
  });

  it("skips invalid port entries within arrays", () => {
    const ports = parseYadrawPorts(
      { inputs: ["valid", "UPPERCASE", ""], outputs: ["ok"] },
      cardTypeId,
      workspaceId,
      ts
    );
    expect(ports).toHaveLength(2);
    expect(ports[0]!.key).toBe("valid");
    expect(ports[1]!.key).toBe("ok");
  });
});

describe("legacyCardFromRow — _yadraw stripping", () => {
  const validId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const validBoardId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("strips _yadraw from card data", () => {
    const row = {
      id: validId,
      workspace_id: workspaceId,
      board_id: validBoardId,
      type_id: cardTypeId,
      title: "Test Card",
      description: "A test",
      data: {
        endpoint: "/webhook",
        _yadraw: { inputs: ["data"], outputs: ["result"], typeKey: "trigger" },
      },
      position: { x: 100, y: 200 },
      size: { width: 300, height: 180 },
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T01:00:00.000Z",
    };

    const result = legacyCardFromRow(row);
    // _yadraw should be returned separately
    expect(result._yadraw).toEqual({
      inputs: ["data"],
      outputs: ["result"],
      typeKey: "trigger",
    });

    // _yadraw should NOT be in card.data
    expect(result.card.data).not.toHaveProperty("_yadraw");
    expect(result.card.data).toEqual({ endpoint: "/webhook" });
  });

  it("handles missing _yadraw gracefully", () => {
    const row = {
      id: validId,
      workspace_id: workspaceId,
      board_id: validBoardId,
      type_id: cardTypeId,
      title: "Minimal Card",
      description: "",
      data: { key: "value" },
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      status: "draft",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const result = legacyCardFromRow(row);
    expect(result._yadraw).toBeUndefined();
    expect(result.card.data).toEqual({ key: "value" });
  });

  it("handles null data gracefully", () => {
    const row = {
      id: validId,
      workspace_id: workspaceId,
      board_id: validBoardId,
      type_id: cardTypeId,
      title: "Null data Card",
      description: "",
      data: null,
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      status: "draft",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    const result = legacyCardFromRow(row);
    expect(result._yadraw).toBeUndefined();
    expect(result.card.data).toEqual({});
  });
});
