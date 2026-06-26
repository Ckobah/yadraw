import {
  v2CreateCardBodySchema,
  v2CreateConnectionBodySchema,
  v2UpdateCardBodySchema,
  type V2BoardDetail,
  type V2Card,
  type V2CardType,
  type V2Connection,
  type V2CreateCardRequest,
  type V2CreateConnectionRequest,
  type V2UpdateCardRequest
} from "@yadraw/shared";
import type { V2Repository } from "./repository.js";

export type V2ServiceErrorCode = "not_found" | "validation_failed" | "conflict";

export class V2ServiceError extends Error {
  constructor(
    readonly code: V2ServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "V2ServiceError";
  }
}

export type V2BoardService = {
  getBoard(boardId: string): Promise<V2BoardDetail>;
  listCardTypes(workspaceId: string): Promise<V2CardType[]>;
  createCard(boardId: string, input: V2CreateCardRequest): Promise<V2Card>;
  updateCard(cardId: string, input: V2UpdateCardRequest): Promise<V2Card>;
  deleteCard(cardId: string): Promise<{ deleted: true; id: string }>;
  createConnection(boardId: string, input: V2CreateConnectionRequest): Promise<V2Connection>;
  deleteConnection(connectionId: string): Promise<{ deleted: true; id: string }>;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function notFound(message: string): never {
  throw new V2ServiceError("not_found", message);
}

function validationFailed(message: string): never {
  throw new V2ServiceError("validation_failed", message);
}

function conflict(message: string): never {
  throw new V2ServiceError("conflict", message);
}

export function createV2BoardService(repository: V2Repository): V2BoardService {
  return {
    async getBoard(boardId) {
      const board = await repository.getBoardDetail(boardId);
      if (!board) {
        notFound("Board not found");
      }

      return board;
    },

    async listCardTypes(workspaceId) {
      return repository.listCardTypes(workspaceId);
    },

    async createCard(boardId, rawInput) {
      const input = v2CreateCardBodySchema.parse(rawInput);
      const board = await repository.getBoard(boardId);
      if (!board) {
        notFound("Board not found");
      }

      const cardType = await repository.getCardType(input.cardTypeId);
      if (!cardType) {
        notFound("Card type not found");
      }

      if (cardType.workspaceId !== board.workspaceId) {
        validationFailed("Card type does not belong to the board workspace");
      }

      return repository.createCard({
        workspaceId: board.workspaceId,
        boardId: board.id,
        cardTypeId: cardType.id,
        title: input.title ?? cardType.name,
        description: input.description ?? "",
        data: cloneJson(input.data ?? cardType.defaultData),
        position: input.position ?? { x: 0, y: 0 },
        size: input.size ?? cardType.defaultSize,
        status: input.status ?? "draft"
      });
    },

    async updateCard(cardId, rawInput) {
      const input = v2UpdateCardBodySchema.parse(rawInput);
      const card = await repository.updateCard(cardId, input);
      if (!card) {
        notFound("Card not found");
      }

      return card;
    },

    async deleteCard(cardId) {
      const deleted = await repository.deleteCard(cardId);
      if (!deleted) {
        notFound("Card not found");
      }

      return { deleted: true, id: cardId };
    },

    async createConnection(boardId, rawInput) {
      const input = v2CreateConnectionBodySchema.parse(rawInput);
      const board = await repository.getBoard(boardId);
      if (!board) {
        notFound("Board not found");
      }

      if (input.sourceCardId === input.targetCardId) {
        validationFailed("Connection cannot link a card to itself");
      }

      const sourceCard = await repository.getCard(input.sourceCardId);
      const targetCard = await repository.getCard(input.targetCardId);

      if (!sourceCard || sourceCard.boardId !== board.id) {
        notFound("Source card not found on board");
      }

      if (!targetCard || targetCard.boardId !== board.id) {
        notFound("Target card not found on board");
      }

      if (sourceCard.workspaceId !== board.workspaceId || targetCard.workspaceId !== board.workspaceId) {
        validationFailed("Connection cards must belong to the board workspace");
      }

      const sourceType = await repository.getCardType(sourceCard.cardTypeId);
      const targetType = await repository.getCardType(targetCard.cardTypeId);

      if (!sourceType) {
        notFound("Source card type not found");
      }

      if (!targetType) {
        notFound("Target card type not found");
      }

      const sourcePort = sourceType.ports.find(
        (port) => port.direction === "output" && port.key === input.sourcePortKey
      );
      if (!sourcePort) {
        validationFailed("Source port is not an output port on the source card type");
      }

      const targetPort = targetType.ports.find(
        (port) => port.direction === "input" && port.key === input.targetPortKey
      );
      if (!targetPort) {
        validationFailed("Target port is not an input port on the target card type");
      }

      const detail = await repository.getBoardDetail(board.id);
      const duplicate = detail?.connections.some(
        (connection) =>
          connection.sourceCardId === input.sourceCardId &&
          connection.targetCardId === input.targetCardId &&
          connection.sourcePortKey === input.sourcePortKey &&
          connection.targetPortKey === input.targetPortKey &&
          connection.type === input.type
      );
      if (duplicate) {
        conflict("Connection already exists");
      }

      return repository.createConnection({
        workspaceId: board.workspaceId,
        boardId: board.id,
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        sourcePortKey: input.sourcePortKey,
        targetPortKey: input.targetPortKey,
        type: input.type,
        label: input.label,
        status: "active"
      });
    },

    async deleteConnection(connectionId) {
      const deleted = await repository.deleteConnection(connectionId);
      if (!deleted) {
        notFound("Connection not found");
      }

      return { deleted: true, id: connectionId };
    }
  };
}
