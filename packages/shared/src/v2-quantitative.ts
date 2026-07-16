import type {
  V2BoardDetail,
  V2CalculationEvaluation,
  V2CalculationInput,
  V2CalculationResult,
  V2CalculationWarning,
  V2Connection,
  V2ConnectionType,
  V2ConnectionTypeFieldSchema,
  V2JsonObject,
  V2RelationshipKind,
  V2SemanticGraph,
  V2SemanticGraphRelation,
  V2SemanticIssue,
  V2SemanticQuantityFact
} from "./v2.js";

export type V2ConnectionDataValidation = {
  validity: "valid" | "incomplete" | "invalid";
  issues: V2SemanticIssue[];
};

type EvaluationOptions = {
  graphRevision: string;
  computedAt: string;
  overrides?: Array<{ cardId: string; patch: V2JsonObject }>;
};

const UNIT_CODE_PATTERN = /^[a-z][a-z0-9._/-]*$/;
const UNIT_CODE_ALIASES: Record<string, string> = {
  pcs: "piece",
  pieces: "piece"
};

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}

function issue(code: string, path: string, message: string): V2SemanticIssue {
  return { code, path, message };
}

function validateNumberField(
  field: V2ConnectionTypeFieldSchema,
  value: unknown
): V2SemanticIssue[] {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return [issue("invalid_type", `data.${field.key}`, `${field.label} must be a finite number.`)];
  }

  const issues: V2SemanticIssue[] = [];
  const constraints = field.numberConstraints;
  if (constraints?.integer && !Number.isInteger(value)) {
    issues.push(issue("not_integer", `data.${field.key}`, `${field.label} must be a whole number.`));
  }
  if (constraints?.min !== undefined && value < constraints.min) {
    issues.push(
      issue("below_minimum", `data.${field.key}`, `${field.label} must be at least ${constraints.min}.`)
    );
  }
  if (constraints?.max !== undefined && value > constraints.max) {
    issues.push(
      issue("above_maximum", `data.${field.key}`, `${field.label} must be at most ${constraints.max}.`)
    );
  }
  return issues;
}

function validateField(field: V2ConnectionTypeFieldSchema, value: unknown): V2SemanticIssue[] {
  if (field.type === "number") return validateNumberField(field, value);
  if (field.type === "text" && typeof value !== "string") {
    return [issue("invalid_type", `data.${field.key}`, `${field.label} must be text.`)];
  }
  if (field.type === "boolean" && typeof value !== "boolean") {
    return [issue("invalid_type", `data.${field.key}`, `${field.label} must be true or false.`)];
  }
  if (field.type === "select") {
    if (typeof value !== "string") {
      return [issue("invalid_type", `data.${field.key}`, `${field.label} must be a choice value.`)];
    }
    const options = field.options ?? [];
    if (options.length > 0 && !options.some((option) => option.value === value)) {
      return [issue("invalid_choice", `data.${field.key}`, `${field.label} has an unknown choice value.`)];
    }
  }
  if (field.type === "date") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return [issue("invalid_date", `data.${field.key}`, `${field.label} must use YYYY-MM-DD.`)];
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return [issue("invalid_date", `data.${field.key}`, `${field.label} must be a real calendar date.`)];
    }
  }
  return [];
}

export function validateV2ConnectionData(
  connectionType: V2ConnectionType | null | undefined,
  data: V2JsonObject
): V2ConnectionDataValidation {
  if (!connectionType) return { validity: "valid", issues: [] };

  const issues: V2SemanticIssue[] = [];
  for (const field of connectionType.schema.fields) {
    const value = data[field.key];
    if (!hasOwn(data, field.key) || isMissing(value)) {
      if (field.required) {
        issues.push(issue("missing_required", `data.${field.key}`, `${field.label} is required.`));
      }
      continue;
    }
    issues.push(...validateField(field, value));
  }

  const quantity = connectionType.schema.semantics?.quantity;
  if (quantity?.unitField) {
    const value = data[quantity.unitField];
    if (!isMissing(value) && (typeof value !== "string" || !UNIT_CODE_PATTERN.test(value.trim()))) {
      issues.push(
        issue(
          "invalid_unit_code",
          `data.${quantity.unitField}`,
          "Unit must be a stable lowercase code such as piece, kg, or m."
        )
      );
    }
  }

  return {
    validity: issues.length === 0
      ? "valid"
      : issues.every((item) => item.code === "missing_required")
        ? "incomplete"
        : "invalid",
    issues
  };
}

export function buildV2ConnectionDefaultData(connectionType: V2ConnectionType | null | undefined): V2JsonObject {
  if (!connectionType) return {};
  return Object.fromEntries(
    connectionType.schema.fields.flatMap((field) =>
      field.defaultValue === undefined ? [] : [[field.key, structuredClone(field.defaultValue)]]
    )
  );
}

export function buildV2EffectiveConnectionData(
  connectionType: V2ConnectionType | null | undefined,
  data: V2JsonObject
): V2JsonObject {
  return {
    ...buildV2ConnectionDefaultData(connectionType),
    ...structuredClone(data)
  };
}

export function resolveV2SemanticQuantityFact(
  connectionType: V2ConnectionType | null | undefined,
  data: V2JsonObject
): V2SemanticQuantityFact | null {
  const quantity = connectionType?.schema.semantics?.quantity;
  if (!quantity) return null;
  const value = data[quantity.valueField];
  const unitFieldValue = quantity.unitField ? data[quantity.unitField] : undefined;
  const rawUnitCode = quantity.fixedUnitCode ?? (
    typeof unitFieldValue === "string"
      ? unitFieldValue.trim()
      : ""
  );
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !rawUnitCode ||
    !UNIT_CODE_PATTERN.test(rawUnitCode)
  ) {
    return null;
  }
  const unitCode = UNIT_CODE_ALIASES[rawUnitCode] ?? rawUnitCode;
  return {
    value,
    unitCode,
    basis: quantity.basis,
    ...(quantity.targetMultiplierField ? { targetMultiplierField: quantity.targetMultiplierField } : {})
  };
}

export function formatV2UnitCode(unitCode: string): string {
  return unitCode === "piece" ? "pcs" : unitCode;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

export function resolveV2RelationshipKind(
  connectionType: V2ConnectionType | null | undefined
): V2RelationshipKind {
  if (connectionType?.schema.semantics?.kind) return connectionType.schema.semantics.kind;
  const key = connectionType?.key.toLowerCase() ?? "";
  if (key === "contains" || key === "part_of" || key === "component_of") return "contains";
  if (key === "needs" || key === "requires" || key === "required_by") return "needs";
  if (key === "uses" || key === "used_by") return "uses";
  if (key === "produces" || key === "produced_by") return "produces";
  if (key === "generic" || key === "related" || key === "related_to") return "related";
  const semantics = connectionType?.schema.semantics;
  if (semantics?.sourceRole === "component" && semantics.targetRole === "assembly") {
    return "contains";
  }
  return "custom";
}

export function buildV2RelationshipStatement(
  sourceTitle: string,
  targetTitle: string,
  connectionType: V2ConnectionType | null | undefined
): string {
  switch (resolveV2RelationshipKind(connectionType)) {
    case "contains":
      return `${sourceTitle} is part of ${targetTitle}`;
    case "needs":
      return `${targetTitle} needs ${sourceTitle}`;
    case "uses":
      return `${sourceTitle} is used by ${targetTitle}`;
    case "produces":
      return `${sourceTitle} produces ${targetTitle}`;
    case "related":
      return `${sourceTitle} is related to ${targetTitle}`;
    default:
      return `${sourceTitle} connects to ${targetTitle}`;
  }
}

export function getV2RelationshipGuidance(
  connection: V2Connection,
  connectionType: V2ConnectionType | null | undefined
): string | null {
  const effectiveData = buildV2EffectiveConnectionData(connectionType, connection.data);
  const validation = validateV2ConnectionData(connectionType, effectiveData);
  if (validation.validity === "valid" && connection.status !== "draft") return null;
  const quantity = connectionType?.schema.semantics?.quantity;
  if (quantity && validation.issues.some((item) => item.path === `data.${quantity.valueField}`)) {
    return "Enter a quantity to include this relationship in totals.";
  }
  if (
    quantity?.unitField &&
    validation.issues.some((item) => item.path === `data.${quantity.unitField}`)
  ) {
    return "Choose a unit to include this relationship in totals.";
  }
  const firstIssue = validation.issues[0];
  return firstIssue?.message ?? "Complete the relationship details to include it in totals.";
}

export function getV2ConnectionSemanticLabel(
  connection: V2Connection,
  connectionType?: V2ConnectionType | null,
  calculationResult?: V2CalculationResult | null
): string | undefined {
  const guidance = getV2RelationshipGuidance(connection, connectionType);
  if (guidance) {
    const quantity = connectionType?.schema.semantics?.quantity;
    const valuePath = quantity ? `data.${quantity.valueField}` : null;
    const effectiveData = buildV2EffectiveConnectionData(connectionType, connection.data);
    const validation = validateV2ConnectionData(connectionType, effectiveData);
    return valuePath && validation.issues.some((item) => item.path === valuePath)
      ? "Enter quantity"
      : "Needs attention";
  }
  const effectiveData = buildV2EffectiveConnectionData(connectionType, connection.data);
  const quantity = resolveV2SemanticQuantityFact(connectionType, effectiveData);
  if (quantity) {
    const value = `${formatNumber(quantity.value)} ${formatV2UnitCode(quantity.unitCode)}`;
    const quantityPath = connectionType?.schema.semantics?.quantity
      ? `data.${connectionType.schema.semantics.quantity.valueField}`
      : null;
    const calculationMatchesCurrentQuantity = Boolean(
      calculationResult?.connectionId === connection.id &&
      quantityPath &&
      calculationResult.inputs.some(
        (input) => input.id === connection.id && input.path === quantityPath && input.value === quantity.value
      )
    );
    if (calculationResult && calculationMatchesCurrentQuantity) {
      const total = `${formatNumber(calculationResult.value)} ${formatV2UnitCode(calculationResult.unitCode)}`;
      if (quantity.basis === "absolute") return `${total} total`;
      return calculationResult.value === quantity.value
        ? `${value} each`
        : `${value} each · ${total} total`;
    }
    return quantity.basis === "per_target"
      ? `${value} / ${connectionType?.schema.semantics?.targetRole ?? "target"}`
      : `${value} total`;
  }

  const legacyQuantity = connection.data.quantity;
  const legacyUnit = connection.data.unit;
  if (
    (typeof legacyQuantity === "number" || typeof legacyQuantity === "string") &&
    String(legacyQuantity).trim()
  ) {
    const unitText = typeof legacyUnit === "string" ? legacyUnit.trim() : "";
    return unitText ? `${legacyQuantity} ${unitText}` : String(legacyQuantity);
  }
  if (connection.title?.trim()) return connection.title.trim();
  if (connectionType?.name.trim()) return connectionType.name.trim();
  return connection.label || undefined;
}

function relationFromConnection(
  connection: V2Connection,
  connectionType: V2ConnectionType | undefined,
  sourceTitle: string,
  targetTitle: string
): V2SemanticGraphRelation {
  const effectiveData = buildV2EffectiveConnectionData(connectionType, connection.data);
  const validation = validateV2ConnectionData(connectionType, effectiveData);
  const semantics = connectionType?.schema.semantics;
  return {
    id: connection.id,
    predicate: connectionType?.key ?? connection.type,
    kind: resolveV2RelationshipKind(connectionType),
    statement: buildV2RelationshipStatement(sourceTitle, targetTitle, connectionType),
    connectionTypeId: connection.connectionTypeId,
    connectionTypeName: connectionType?.name ?? "Generic",
    title: connection.title,
    description: connection.description,
    status: connection.status,
    source: {
      cardId: connection.sourceCardId,
      role: semantics?.sourceRole ?? "source",
      portKey: connection.sourcePortKey
    },
    target: {
      cardId: connection.targetCardId,
      role: semantics?.targetRole ?? "target",
      portKey: connection.targetPortKey
    },
    data: effectiveData,
    quantity: validation.validity === "valid"
      ? resolveV2SemanticQuantityFact(connectionType, effectiveData)
      : null,
    validity: validation.validity,
    issues: validation.issues
  };
}

export function buildV2SemanticGraph(
  detail: V2BoardDetail,
  graphRevision: string,
  generatedAt: string
): V2SemanticGraph {
  const cardTypeById = new Map(detail.cardTypes.map((cardType) => [cardType.id, cardType]));
  const connectionTypeById = new Map(detail.connectionTypes.map((type) => [type.id, type]));
  const cardById = new Map(detail.cards.map((card) => [card.id, card]));
  return {
    schemaVersion: 1,
    boardId: detail.board.id,
    graphRevision,
    generatedAt,
    nodes: [...detail.cards]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((card) => {
        const cardType = cardTypeById.get(card.cardTypeId);
        return {
          id: card.id,
          typeId: card.cardTypeId,
          typeKey: cardType?.key ?? "unknown",
          typeName: cardType?.name ?? "Unknown",
          title: card.title,
          description: card.description,
          status: card.status,
          data: structuredClone(card.data)
        };
      }),
    relations: [...detail.connections]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((connection) => relationFromConnection(
        connection,
        connection.connectionTypeId ? connectionTypeById.get(connection.connectionTypeId) : undefined,
        cardById.get(connection.sourceCardId)?.title ?? "Unknown card",
        cardById.get(connection.targetCardId)?.title ?? "Unknown card"
      ))
  };
}

function buildCardData(detail: V2BoardDetail, options: EvaluationOptions): Map<string, V2JsonObject> {
  const dataByCardId = new Map(detail.cards.map((card) => [card.id, structuredClone(card.data)]));
  for (const override of options.overrides ?? []) {
    const current = dataByCardId.get(override.cardId);
    if (current) dataByCardId.set(override.cardId, { ...current, ...structuredClone(override.patch) });
  }
  return dataByCardId;
}

function detectQuantitativeCycles(
  connections: V2Connection[],
  connectionTypeById: Map<string, V2ConnectionType>
): V2CalculationWarning[] {
  const outgoing = new Map<string, Array<{ cardId: string; connectionId: string }>>();
  for (const connection of connections) {
    const type = connection.connectionTypeId ? connectionTypeById.get(connection.connectionTypeId) : undefined;
    if (connection.status !== "active" || !type?.schema.semantics?.quantity) continue;
    const next = outgoing.get(connection.sourceCardId) ?? [];
    next.push({ cardId: connection.targetCardId, connectionId: connection.id });
    outgoing.set(connection.sourceCardId, next);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleConnections = new Set<string>();
  function visit(cardId: string) {
    if (visited.has(cardId)) return;
    visiting.add(cardId);
    for (const edge of outgoing.get(cardId) ?? []) {
      if (visiting.has(edge.cardId)) cycleConnections.add(edge.connectionId);
      else visit(edge.cardId);
    }
    visiting.delete(cardId);
    visited.add(cardId);
  }
  for (const cardId of outgoing.keys()) visit(cardId);
  return [...cycleConnections].sort().map((connectionId) => ({
    code: "quantitative_cycle",
    message: "This relationship creates a quantity cycle. Direct totals are shown, but nested expansion was skipped.",
    connectionId
  }));
}

export function evaluateV2QuantitativeGraph(
  detail: V2BoardDetail,
  options: EvaluationOptions
): V2CalculationEvaluation {
  const connectionTypeById = new Map(detail.connectionTypes.map((type) => [type.id, type]));
  const cardById = new Map(detail.cards.map((card) => [card.id, card]));
  const cardDataById = buildCardData(detail, options);
  const results: V2CalculationResult[] = [];
  const warnings: V2CalculationWarning[] = detectQuantitativeCycles(detail.connections, connectionTypeById);

  for (const connection of [...detail.connections].sort((a, b) => a.id.localeCompare(b.id))) {
    const connectionType = connection.connectionTypeId
      ? connectionTypeById.get(connection.connectionTypeId)
      : undefined;
    const semantics = connectionType?.schema.semantics?.quantity;
    if (!semantics) continue;
    if (connection.status === "draft") {
      warnings.push({
        code: "draft_quantitative_connection",
        message: "Enter the missing relationship values to include it in totals.",
        connectionId: connection.id
      });
      continue;
    }
    if (connection.status !== "active") continue;

    const effectiveData = buildV2EffectiveConnectionData(connectionType, connection.data);
    const validation = validateV2ConnectionData(connectionType, effectiveData);
    if (validation.validity !== "valid") {
      for (const validationIssue of validation.issues) {
        warnings.push({
          code: validationIssue.code,
          message: validationIssue.message,
          connectionId: connection.id
        });
      }
      continue;
    }

    const quantity = resolveV2SemanticQuantityFact(connectionType, effectiveData);
    if (!quantity) {
      warnings.push({
        code: "missing_quantity",
        message: "Quantitative relationship has no usable quantity and unit.",
        connectionId: connection.id
      });
      continue;
    }

    const inputs: V2CalculationInput[] = [{
      kind: hasOwn(connection.data, semantics.valueField) ? "connection_field" : "default",
      id: connection.id,
      path: `data.${semantics.valueField}`,
      value: quantity.value
    }];
    if (semantics.unitField) {
      inputs.push({
        kind: hasOwn(connection.data, semantics.unitField) ? "connection_field" : "default",
        id: connection.id,
        path: `data.${semantics.unitField}`,
        value: quantity.unitCode
      });
    } else if (semantics.fixedUnitCode) {
      inputs.push({
        kind: "default",
        id: connection.id,
        path: "schema.semantics.quantity.fixedUnitCode",
        value: quantity.unitCode
      });
    }
    let multiplier = 1;
    if (quantity.basis === "per_target") {
      if (quantity.targetMultiplierField) {
        const targetData = cardDataById.get(connection.targetCardId);
        const rawMultiplier = targetData?.[quantity.targetMultiplierField];
        if (rawMultiplier === undefined || rawMultiplier === null || rawMultiplier === "") {
          warnings.push({
            code: "missing_target_multiplier",
            message: "Planned target quantity is missing, so one target item was used.",
            cardId: connection.targetCardId,
            connectionId: connection.id
          });
          inputs.push({
            kind: "default",
            id: connection.targetCardId,
            path: `data.${quantity.targetMultiplierField}`,
            value: 1
          });
        } else if (typeof rawMultiplier !== "number" || !Number.isFinite(rawMultiplier) || rawMultiplier < 0) {
          warnings.push({
            code: "invalid_target_multiplier",
            message: "Planned target quantity must be a non-negative number.",
            cardId: connection.targetCardId,
            connectionId: connection.id
          });
          continue;
        } else {
          multiplier = rawMultiplier;
          const targetMultiplierWasOverridden = options.overrides?.some(
            (override) =>
              override.cardId === connection.targetCardId &&
              hasOwn(override.patch, quantity.targetMultiplierField!)
          );
          inputs.push({
            kind: targetMultiplierWasOverridden
              ? "override"
              : "card_field",
            id: connection.targetCardId,
            path: `data.${quantity.targetMultiplierField}`,
            value: rawMultiplier
          });
        }
      } else {
        inputs.push({ kind: "default", id: connection.targetCardId, path: "$target", value: 1 });
      }
    }

    const value = quantity.value * multiplier;
    if (!Number.isFinite(value)) {
      warnings.push({
        code: "non_finite_result",
        message: "Calculation produced a non-finite result.",
        connectionId: connection.id
      });
      continue;
    }
    results.push({
      id: `required:${connection.id}`,
      metric: "required_quantity",
      sourceCardId: connection.sourceCardId,
      targetCardId: connection.targetCardId,
      connectionId: connection.id,
      value,
      unitCode: quantity.unitCode,
      formulaId: "bom.required.v1",
      explanation: quantity.basis === "per_target"
        ? `${formatNumber(quantity.value)} ${formatV2UnitCode(quantity.unitCode)} per ${cardById.get(connection.targetCardId)?.title ?? "target"} × ${formatNumber(multiplier)} = ${formatNumber(value)} ${formatV2UnitCode(quantity.unitCode)}`
        : `${formatNumber(value)} ${formatV2UnitCode(quantity.unitCode)} total`,
      inputs
    });
  }

  const totalsByKey = new Map<string, { cardId: string; unitCode: string; value: number; resultIds: string[] }>();
  for (const result of results) {
    const key = `${result.sourceCardId}\u0000${result.unitCode}`;
    const current = totalsByKey.get(key) ?? {
      cardId: result.sourceCardId,
      unitCode: result.unitCode,
      value: 0,
      resultIds: []
    };
    current.value += result.value;
    current.resultIds.push(result.id);
    totalsByKey.set(key, current);
  }

  return {
    schemaVersion: 1,
    boardId: detail.board.id,
    graphRevision: options.graphRevision,
    computedAt: options.computedAt,
    formulaVersion: "bom.required.v1",
    results,
    totals: [...totalsByKey.values()].sort(
      (a, b) => a.cardId.localeCompare(b.cardId) || a.unitCode.localeCompare(b.unitCode)
    ),
    warnings
  };
}
