import { describe, expect, it } from "vitest";
import {
  v2CardTypeDefinitionSchema,
  v2CardTypePortInputSchema,
  v2CardVisualStyleSchema,
  v2ConnectionTypeDefinitionSchema,
  v2ConnectionVisualStyleSchema,
  v2JsonObjectSchema,
  v2SizeSchema,
  v2ViewportSchema,
  type V2BoardBlueprintKey
} from "@yadraw/shared";
import { getV2BoardBlueprint } from "./blueprints.js";

const blueprintKeys: V2BoardBlueprintKey[] = [
  "process_map_v1",
  "typed_knowledge_graph_v1"
];

describe("V2 board blueprints", () => {
  it.each(blueprintKeys)("keeps %s server definitions valid and internally connected", (key) => {
    const blueprint = getV2BoardBlueprint(key);
    expect(blueprint.key).toBe(key);
    expect(blueprint.version).toBe(1);
    expect(() => v2ViewportSchema.parse(blueprint.viewport)).not.toThrow();

    const cardTypeKeys = new Set<string>();
    const cardTypePorts = new Map<string, Map<string, "input" | "output">>();
    for (const cardType of blueprint.cardTypes) {
      expect(cardTypeKeys.has(cardType.key)).toBe(false);
      cardTypeKeys.add(cardType.key);
      expect(() => v2JsonObjectSchema.parse(cardType.defaultData)).not.toThrow();
      expect(() => v2CardTypeDefinitionSchema.parse(cardType.schema)).not.toThrow();
      expect(() => v2SizeSchema.parse(cardType.defaultSize)).not.toThrow();
      expect(() => v2CardVisualStyleSchema.parse(cardType.defaultVisualStyle)).not.toThrow();
      const ports = new Map<string, "input" | "output">();
      for (const port of cardType.ports) {
        expect(() => v2CardTypePortInputSchema.parse(port)).not.toThrow();
        expect(ports.has(port.key)).toBe(false);
        ports.set(port.key, port.direction);
      }
      cardTypePorts.set(cardType.key, ports);
    }

    const connectionTypeKeys = new Set<string>();
    for (const connectionType of blueprint.connectionTypes) {
      expect(connectionTypeKeys.has(connectionType.key)).toBe(false);
      connectionTypeKeys.add(connectionType.key);
      expect(() => v2ConnectionTypeDefinitionSchema.parse(connectionType.schema)).not.toThrow();
      expect(() => v2ConnectionVisualStyleSchema.parse(connectionType.defaultVisualStyle)).not.toThrow();
    }

    const cardsByKey = new Map(blueprint.cards.map((card) => [card.localKey, card]));
    expect(cardsByKey.size).toBe(blueprint.cards.length);
    for (const card of blueprint.cards) {
      expect(cardTypeKeys.has(card.cardTypeKey)).toBe(true);
      expect(() => v2JsonObjectSchema.parse(card.data)).not.toThrow();
      if (card.size) expect(() => v2SizeSchema.parse(card.size)).not.toThrow();
      if (card.visualStyle) {
        expect(() => v2CardVisualStyleSchema.parse(card.visualStyle)).not.toThrow();
      }
    }

    for (const connection of blueprint.connections) {
      expect(connectionTypeKeys.has(connection.connectionTypeKey)).toBe(true);
      const source = cardsByKey.get(connection.sourceCardKey);
      const target = cardsByKey.get(connection.targetCardKey);
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      expect(source?.localKey).not.toBe(target?.localKey);
      expect(cardTypePorts.get(source!.cardTypeKey)?.get(connection.sourcePortKey)).toBe("output");
      expect(cardTypePorts.get(target!.cardTypeKey)?.get(connection.targetPortKey)).toBe("input");
      expect(() => v2JsonObjectSchema.parse(connection.data)).not.toThrow();
      if (connection.visualStyle) {
        expect(() => v2ConnectionVisualStyleSchema.parse(connection.visualStyle)).not.toThrow();
      }
    }
  });
});
