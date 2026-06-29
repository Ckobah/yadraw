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
import type { RequestContext } from "../context.js";
import { hasV2WorkspaceAccess, type V2AccessLevel } from "./policy.js";
import type { V2Repository } from "./repository.js";

export type V2ServiceErrorCode = "not_found" | "validation_failed" | "conflict" | "forbidden";

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
  getBoard(context: RequestContext, boardId: string): Promise<V2BoardDetail>;
  listCardTypes(context: RequestContext, workspaceId: string): Promise<{ cardTypes: V2CardType[] }>;
  createCard(context: RequestContext, boardId: string, input: V2CreateCardRequest): Promise<V2Card>;
  updateCard(context: RequestContext, cardId: string, input: V2UpdateCardRequest): Promise<V2Card>;
  deleteCard(context: RequestContext, cardId: string): Promise<{ deleted: true; id: string }>;
  createConnection(context: RequestContext, boardId: string, input: V2CreateConnectionRequest): Promise<V2Connection>;
  deleteConnection(context: RequestContext, connectionId: string): Promise<{ deleted: true; id: string }>;
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

function forbidden(): never {
  throw new V2ServiceError("forbidden", "Forbidden");
}

export function createV2BoardService(repository: V2Repository): V2BoardService {
  async function authorizeWorkspace(context: RequestContext, workspaceId: string, accessLevel: V2AccessLevel) {
    const role = await repository.getWorkspaceRole(context.userId, workspaceId);
    if (!hasV2WorkspaceAccess(role, accessLevel)) forbidden();
  }

  return {
    async getBoard(context, boardId) {
      const board = await repository.getBoardDetail(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspace.id, "read");

      return board;
    },

    async listCardTypes(context, workspaceId) {
      await authorizeWorkspace(context, workspaceId, "read");
      return { cardTypes: await repository.listCardTypes(workspaceId) };
    },

    async createCard(context, boardId, rawInput) {
      const input = v2CreateCardBodySchema.parse(rawInput);
      const board = await repository.getBoard(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspaceId, "write");

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
        visualStyle: cloneJson(input.visualStyle ?? {}),
        status: input.status ?? "draft"
      });
    },

    async updateCard(context, cardId, rawInput) {
      const input = v2UpdateCardBodySchema.parse(rawInput);
      const existing = await repository.getCard(cardId);
      if (!existing) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");
      const card = await repository.updateCard(cardId, input);
      if (!card) {
        notFound("Card not found");
      }

      return card;
    },

    async deleteCard(context, cardId) {
      const existing = await repository.getCard(cardId);
      if (!existing) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");
      const deleted = await repository.deleteCard(cardId);
      if (!deleted) {
        notFound("Card not found");
      }

      return { deleted: true, id: cardId };
    },

    async createConnection(context, boardId, rawInput) {
      const input = v2CreateConnectionBodySchema.parse(rawInput);
      const board = await repository.getBoard(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspaceId, "write");

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

    async deleteConnection(context, connectionId) {
      const existing = await repository.getConnection(connectionId);
      if (!existing) {
        notFound("Connection not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");
      const deleted = await repository.deleteConnection(connectionId);
      if (!deleted) {
        notFound("Connection not found");
      }

      return { deleted: true, id: connectionId };
    }
  };
}
