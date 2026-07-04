import type {
  V2Board,
  V2Card,
  V2CardAttachment,
  V2CardType,
  V2Connection,
  V2DryRunResult,
} from "@yadraw/shared";

export type V2AssistantQuestionId =
  | "summary"
  | "selected"
  | "connected"
  | "unconnected"
  | "files"
  | "tags"
  | "demoWorkflow";

export type V2AssistantQuestion = {
  id: V2AssistantQuestionId;
  label: string;
};

export type V2AssistantAnswer = {
  title: string;
  lines: string[];
};

export type V2BoardAssistantContext = {
  board: V2Board;
  cards: V2Card[];
  connections: V2Connection[];
  cardTypes: V2CardType[];
  selectedCardId: string | null;
  dryRunResult?: V2DryRunResult | null;
  cardAttachmentsByCardId?: Map<string, V2CardAttachment[]>;
};

export const V2_ASSISTANT_QUESTIONS: V2AssistantQuestion[] = [
  { id: "summary", label: "Summarize this board." },
  { id: "selected", label: "What is selected?" },
  { id: "connected", label: "What is connected to the selected card?" },
  { id: "unconnected", label: "Which cards have no connections?" },
  { id: "files", label: "What files are attached to the selected card?" },
  { id: "tags", label: "What tags are used on this board?" },
  { id: "demoWorkflow", label: "What changed in the current demo workflow?" },
];

function pluralize(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function sortByTitle(cards: V2Card[]): V2Card[] {
  return [...cards].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

function buildCardTypeMap(cardTypes: V2CardType[]): Map<string, V2CardType> {
  return new Map(cardTypes.map((cardType) => [cardType.id, cardType]));
}

function buildCardMap(cards: V2Card[]): Map<string, V2Card> {
  return new Map(cards.map((card) => [card.id, card]));
}

function selectedCard(context: V2BoardAssistantContext): V2Card | null {
  if (!context.selectedCardId) return null;
  return context.cards.find((card) => card.id === context.selectedCardId) ?? null;
}

function cardTypeName(card: V2Card, cardTypeMap: Map<string, V2CardType>): string {
  const cardType = cardTypeMap.get(card.cardTypeId);
  return cardType ? `${cardType.name} (${cardType.key})` : "Unknown type";
}

function dataKeys(card: V2Card): string {
  const keys = Object.keys(card.data).sort();
  return keys.length > 0 ? keys.join(", ") : "none";
}

function connectionCounts(cardId: string, connections: V2Connection[]) {
  return {
    incoming: connections.filter((connection) => connection.targetCardId === cardId),
    outgoing: connections.filter((connection) => connection.sourceCardId === cardId),
  };
}

function isolatedCards(cards: V2Card[], connections: V2Connection[]): V2Card[] {
  const connectedCardIds = new Set<string>();
  for (const connection of connections) {
    connectedCardIds.add(connection.sourceCardId);
    connectedCardIds.add(connection.targetCardId);
  }
  return sortByTitle(cards.filter((card) => !connectedCardIds.has(card.id)));
}

function typeCounts(cards: V2Card[], cardTypeMap: Map<string, V2CardType>): string {
  if (cards.length === 0) return "none";

  const counts = new Map<string, number>();
  for (const card of cards) {
    const label = cardTypeMap.get(card.cardTypeId)?.name ?? "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => `${label}: ${count}`)
    .join(", ");
}

function extractTags(cards: V2Card[]): string[] {
  const tags = new Set<string>();
  for (const card of cards) {
    const rawTags = card.data.tags;
    if (Array.isArray(rawTags)) {
      for (const tag of rawTags) {
        if (typeof tag === "string" && tag.trim()) {
          tags.add(tag.trim());
        }
      }
    }

    const rawTag = card.data.tag;
    if (typeof rawTag === "string" && rawTag.trim()) {
      tags.add(rawTag.trim());
    }
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

export function buildBoardSummary(context: V2BoardAssistantContext): V2AssistantAnswer {
  const cardTypeMap = buildCardTypeMap(context.cardTypes);
  const selected = selectedCard(context);
  const isolated = isolatedCards(context.cards, context.connections);

  return {
    title: "Board summary",
    lines: [
      `Board: ${context.board.name}`,
      `${pluralize("card", context.cards.length)} and ${pluralize("connection", context.connections.length)} are loaded.`,
      `Card types: ${typeCounts(context.cards, cardTypeMap)}.`,
      `${pluralize("isolated card", isolated.length)} with no incoming or outgoing connections.`,
      selected ? `Selected card: ${selected.title}.` : "No card is selected.",
    ],
  };
}

export function answerSelectedCard(context: V2BoardAssistantContext): V2AssistantAnswer {
  const card = selectedCard(context);
  if (!context.selectedCardId) {
    return {
      title: "Selected card",
      lines: ["No card is selected."],
    };
  }
  if (!card) {
    return {
      title: "Selected card",
      lines: ["The selected card is not present in the current loaded board state."],
    };
  }

  const cardTypeMap = buildCardTypeMap(context.cardTypes);
  const counts = connectionCounts(card.id, context.connections);
  const attachments = context.cardAttachmentsByCardId?.get(card.id);

  return {
    title: "Selected card",
    lines: [
      `Title: ${card.title}`,
      `Description: ${card.description || "none"}`,
      `Type: ${cardTypeName(card, cardTypeMap)}`,
      `Status: ${card.status}`,
      `Data keys: ${dataKeys(card)}`,
      `Connections: ${counts.incoming.length} incoming, ${counts.outgoing.length} outgoing.`,
      attachments
        ? `Loaded files: ${attachments.length > 0 ? attachments.map((item) => item.filename).join(", ") : "none"}.`
        : "File details are not loaded in the current board state.",
      `Tags: ${extractTags([card]).join(", ") || "none"}.`,
    ],
  };
}

export function answerConnectedCards(context: V2BoardAssistantContext): V2AssistantAnswer {
  const card = selectedCard(context);
  if (!context.selectedCardId) {
    return {
      title: "Connected cards",
      lines: ["Select a card to inspect its incoming and outgoing connections."],
    };
  }
  if (!card) {
    return {
      title: "Connected cards",
      lines: ["The selected card is not present in the current loaded board state."],
    };
  }

  const cardById = buildCardMap(context.cards);
  const counts = connectionCounts(card.id, context.connections);
  const incoming = counts.incoming.map((connection) => {
    const source = cardById.get(connection.sourceCardId);
    return `Incoming from ${source?.title ?? "Unknown card"} via ${connection.label || connection.sourcePortKey}.`;
  });
  const outgoing = counts.outgoing.map((connection) => {
    const target = cardById.get(connection.targetCardId);
    return `Outgoing to ${target?.title ?? "Unknown card"} via ${connection.label || connection.sourcePortKey}.`;
  });

  return {
    title: "Connected cards",
    lines: [
      incoming.length > 0 ? incoming.join(" ") : "No incoming cards.",
      outgoing.length > 0 ? outgoing.join(" ") : "No outgoing cards.",
    ],
  };
}

export function answerUnconnectedCards(context: V2BoardAssistantContext): V2AssistantAnswer {
  const isolated = isolatedCards(context.cards, context.connections);

  return {
    title: "Unconnected cards",
    lines: [
      isolated.length > 0
        ? isolated.map((card) => card.title).join(", ")
        : "Every loaded card has at least one incoming or outgoing connection.",
    ],
  };
}

export function answerSelectedCardFiles(context: V2BoardAssistantContext): V2AssistantAnswer {
  const card = selectedCard(context);
  if (!context.selectedCardId) {
    return {
      title: "Selected card files",
      lines: ["Select a card to inspect its files."],
    };
  }
  if (!card) {
    return {
      title: "Selected card files",
      lines: ["The selected card is not present in the current loaded board state."],
    };
  }

  const attachments = context.cardAttachmentsByCardId?.get(card.id);
  if (!attachments) {
    return {
      title: "Selected card files",
      lines: ["I do not have attachment details loaded for this card in the current board state."],
    };
  }

  return {
    title: "Selected card files",
    lines: [
      attachments.length > 0
        ? attachments.map((attachment) => attachment.filename).join(", ")
        : "No loaded files are attached to this card.",
    ],
  };
}

export function answerBoardTags(context: V2BoardAssistantContext): V2AssistantAnswer {
  const tags = extractTags(context.cards);

  return {
    title: "Board tags",
    lines: [
      tags.length > 0
        ? tags.join(", ")
        : "No tags are present in the loaded board state.",
    ],
  };
}

export function answerDemoWorkflow(context: V2BoardAssistantContext): V2AssistantAnswer {
  const dryRun = context.dryRunResult;
  const dryRunLine = dryRun
    ? `Most recent dry-run preview: ${dryRun.steps.map((step) => step.title).join(" -> ") || "no steps"}.`
    : "No dry-run result is loaded in this browser session.";

  return {
    title: "Current demo workflow",
    lines: [
      dryRunLine,
      "This foundation UI can inspect V2 cards, edit card content, manage visual layout, draw connections, attach files through existing file UI, and preview a deterministic dry-run.",
      "This assistant is demo deterministic mode only: it does not call an AI model, run workflow code, read files, or use external APIs.",
    ],
  };
}

export function answerBoardAssistantQuestion(
  questionId: V2AssistantQuestionId,
  context: V2BoardAssistantContext
): V2AssistantAnswer {
  switch (questionId) {
    case "summary":
      return buildBoardSummary(context);
    case "selected":
      return answerSelectedCard(context);
    case "connected":
      return answerConnectedCards(context);
    case "unconnected":
      return answerUnconnectedCards(context);
    case "files":
      return answerSelectedCardFiles(context);
    case "tags":
      return answerBoardTags(context);
    case "demoWorkflow":
      return answerDemoWorkflow(context);
  }
}
