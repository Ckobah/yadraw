import type { V2Card, V2CardType, V2Connection } from "@yadraw/shared";

export type V2LinkedFieldDirection = "incoming" | "outgoing";

export type V2LinkedFieldDraft = {
  id: string;
  targetCardId: string;
  targetField: string;
  direction: V2LinkedFieldDirection;
  sourceCardId?: string;
  sourceCardTypeId?: string | null;
  sourceCardTypeKey?: string | null;
  sourceFieldPath: string;
  sourceMode: "exactCard" | "connectedCard";
  onMissing: "empty";
  onMultiple: "warning";
};

export type V2ResolvedLinkedField = {
  bindingId: string;
  targetField: string;
  value: unknown;
  status:
    | "resolved"
    | "missing_source"
    | "missing_field"
    | "multiple_sources"
    | "invalid";
  message?: string;
};

type ResolveLinkedFieldsInput = {
  drafts: V2LinkedFieldDraft[];
  targetCard: V2Card;
  cards: V2Card[];
  connections: V2Connection[];
  cardTypes: V2CardType[];
};

const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function readPath(sourceCard: V2Card, path: string): { found: true; value: unknown } | { found: false } {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0 || segments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) {
    return { found: false };
  }

  let current: unknown = sourceCard as unknown;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return { found: false };
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return { found: true, value: current };
}

function emptyResult(
  draft: V2LinkedFieldDraft,
  status: V2ResolvedLinkedField["status"],
  message: string
): V2ResolvedLinkedField {
  return {
    bindingId: draft.id,
    targetField: draft.targetField,
    value: "",
    status,
    message,
  };
}

function resolveFromCard(
  draft: V2LinkedFieldDraft,
  sourceCard: V2Card | undefined
): V2ResolvedLinkedField {
  if (!sourceCard) {
    return emptyResult(draft, "missing_source", "No source card found.");
  }

  if (sourceCard.id === draft.targetCardId) {
    return emptyResult(draft, "invalid", "Linked fields cannot read from the target card.");
  }

  const resolved = readPath(sourceCard, draft.sourceFieldPath);
  if (!resolved.found) {
    return emptyResult(draft, "missing_field", "Source field is missing.");
  }

  return {
    bindingId: draft.id,
    targetField: draft.targetField,
    value: resolved.value,
    status: "resolved",
  };
}

export function resolveV2LinkedFieldDrafts({
  drafts,
  targetCard,
  cards,
  connections,
  cardTypes,
}: ResolveLinkedFieldsInput): V2ResolvedLinkedField[] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const cardTypeById = new Map(cardTypes.map((cardType) => [cardType.id, cardType]));

  return drafts
    .filter((draft) => draft.targetCardId === targetCard.id)
    .map((draft) => {
      if (!draft.targetField.trim()) {
        return emptyResult(draft, "invalid", "Target field is required.");
      }

      if (!draft.sourceFieldPath.trim()) {
        return emptyResult(draft, "invalid", "Source field path is required.");
      }

      if (draft.sourceMode === "exactCard") {
        return resolveFromCard(draft, draft.sourceCardId ? cardById.get(draft.sourceCardId) : undefined);
      }

      const relatedSourceIds = connections.flatMap((connection) => {
        if (draft.direction === "incoming" && connection.targetCardId === targetCard.id) {
          return [connection.sourceCardId];
        }
        if (draft.direction === "outgoing" && connection.sourceCardId === targetCard.id) {
          return [connection.targetCardId];
        }
        return [];
      });

      const matchingSources = relatedSourceIds
        .map((cardId) => cardById.get(cardId))
        .filter((card): card is V2Card => {
          if (!card) return false;
          if (card.id === targetCard.id) return false;
          if (draft.sourceCardTypeId && card.cardTypeId !== draft.sourceCardTypeId) {
            return false;
          }
          if (draft.sourceCardTypeKey) {
            const cardType = cardTypeById.get(card.cardTypeId);
            return cardType?.key === draft.sourceCardTypeKey;
          }
          return true;
        });

      if (matchingSources.length === 0) {
        return emptyResult(draft, "missing_source", "No connected source card matches this rule.");
      }

      if (matchingSources.length > 1) {
        return emptyResult(draft, "multiple_sources", "Multiple connected source cards match this rule.");
      }

      return resolveFromCard(draft, matchingSources[0]);
    });
}

export function formatLinkedFieldValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2) ?? "";
}
