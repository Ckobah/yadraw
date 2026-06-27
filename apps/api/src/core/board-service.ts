import { z } from "zod";
import {
  buildCardInputFromTemplate,
  createCardInputSchema,
  updateCardInputSchema,
  type Card,
  type CreateCardInput,
  type UpdateCardInput
} from "@yadraw/shared";
import type { RequestContext } from "../context.js";
import type { AttachFileInput, BoardRepository } from "../repository.js";
import { badRequest, invalidPayload, notFound } from "./errors.js";
import { authorizeWorkspaceAction } from "./policy.js";

const attachFileInputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1).max(120).optional(),
  sizeBytes: z.number().int().nonnegative().max(25_000_000).optional(),
  role: z.string().trim().min(1).max(60).default("attachment")
});

const markNotificationReadSchema = z.object({}).strict();

function parseInput<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown,
  message: string
): z.output<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    invalidPayload(message, parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

function cardSnapshot(card: Card): Record<string, unknown> {
  return {
    id: card.id,
    boardId: card.boardId,
    typeKey: card.typeKey,
    title: card.title,
    status: card.status,
    data: card.data,
    position: card.position,
    size: card.size,
    inputs: card.inputs,
    outputs: card.outputs,
    files: card.files,
    tags: card.tags
  };
}

async function getBoardWorkspaceId(repository: BoardRepository, boardId: string): Promise<string> {
  const board = await repository.getBoard(boardId);
  if (!board) notFound("Board not found");
  return board.workspaceId;
}

export function createBoardCore(repository: BoardRepository) {
  return {
    async getHealth() {
      return {
        ok: true,
        service: "yadraw-api",
        storage: repository.mode
      };
    },

    async getBoard(context: RequestContext, boardId: string) {
      await authorizeWorkspaceAction(repository, context, { type: "board", id: boardId }, "read");
      const board = await repository.getBoard(boardId);
      if (!board) notFound("Board not found");
      return board;
    },

    async createCard(context: RequestContext, boardId: string, rawInput: unknown) {
      return repository.transaction(async (transaction) => {
        await authorizeWorkspaceAction(transaction, context, { type: "board", id: boardId }, "write");

        const parsedInput = parseInput(createCardInputSchema, rawInput, "Invalid card payload") as CreateCardInput & {
          templateKey?: string;
        };
        const { templateKey, ...cardOverrides } = parsedInput;
        const board = await transaction.getBoard(boardId);
        if (!board) notFound("Board not found");

        const input = templateKey
          ? buildCardInputFromTemplate(templateKey, { sequence: board.cards.length + 1 })
          : cardOverrides;

        if (!input) {
          badRequest("Unknown card template");
        }

        const card = await transaction.createCard(boardId, {
          ...input,
          ...cardOverrides
        });
        if (!card) notFound("Board not found");

        await transaction.recordActivity({
          workspaceId: board.workspaceId,
          actorId: context.userId,
          action: "card.create",
          objectType: "card",
          objectId: card.id,
          after: cardSnapshot(card),
          metadata: { boardId }
        });

        return card;
      });
    },

    async updateCard(context: RequestContext, cardId: string, rawInput: unknown) {
      return repository.transaction(async (transaction) => {
        await authorizeWorkspaceAction(transaction, context, { type: "card", id: cardId }, "write");

        const patch = parseInput(updateCardInputSchema, rawInput, "Invalid card payload") as UpdateCardInput;
        const before = await transaction.getCard(cardId);
        if (!before) notFound("Card not found");

        const card = await transaction.updateCard(cardId, patch);
        if (!card) notFound("Card not found");
        const workspaceId = await getBoardWorkspaceId(transaction, card.boardId);

        await transaction.recordActivity({
          workspaceId,
          actorId: context.userId,
          action: "card.update",
          objectType: "card",
          objectId: card.id,
          before: cardSnapshot(before),
          after: cardSnapshot(card),
          metadata: { boardId: card.boardId }
        });

        return card;
      });
    },

    async deleteCard(context: RequestContext, cardId: string) {
      return repository.transaction(async (transaction) => {
        await authorizeWorkspaceAction(transaction, context, { type: "card", id: cardId }, "write");

        const before = await transaction.getCard(cardId);
        if (!before) notFound("Card not found");

        const card = await transaction.deleteCard(cardId);
        if (!card) notFound("Card not found");
        const workspaceId = await getBoardWorkspaceId(transaction, card.boardId);

        await transaction.recordActivity({
          workspaceId,
          actorId: context.userId,
          action: "card.delete",
          objectType: "card",
          objectId: card.id,
          before: cardSnapshot(before),
          metadata: { boardId: card.boardId }
        });

        return { deleted: true, card };
      });
    },

    async restoreCard(context: RequestContext, cardId: string) {
      return repository.transaction(async (transaction) => {
        await authorizeWorkspaceAction(transaction, context, { type: "card", id: cardId }, "write");

        const card = await transaction.restoreCard(cardId);
        if (!card) notFound("Deleted card not found");
        const workspaceId = await getBoardWorkspaceId(transaction, card.boardId);

        await transaction.recordActivity({
          workspaceId,
          actorId: context.userId,
          action: "card.restore",
          objectType: "card",
          objectId: card.id,
          after: cardSnapshot(card),
          metadata: { boardId: card.boardId }
        });

        return card;
      });
    },

    async listDeletedCards(context: RequestContext, boardId: string) {
      await authorizeWorkspaceAction(repository, context, { type: "board", id: boardId }, "read");
      return { cards: await repository.listDeletedCards(boardId) };
    },

    async listCardTemplates(context: RequestContext, boardId: string) {
      await authorizeWorkspaceAction(repository, context, { type: "board", id: boardId }, "read");
      const templates = await repository.listCardTemplates(boardId);

      if (templates.length === 0 && !(await repository.getBoard(boardId))) {
        notFound("Board not found");
      }

      return { templates };
    },

    async listWorkspaceMembers(context: RequestContext, workspaceId: string) {
      await authorizeWorkspaceAction(repository, context, { type: "workspace", id: workspaceId }, "read");
      const members = await repository.listWorkspaceMembers(workspaceId);
      if (!members) notFound("Workspace not found");
      return { members };
    },

    async listNotifications(context: RequestContext) {
      const notifications = await repository.listNotifications(context.userId);
      return {
        notifications,
        unreadCount: notifications.filter((notification) => !notification.readAt).length
      };
    },

    async markNotificationRead(context: RequestContext, notificationId: string, rawInput: unknown) {
      parseInput(markNotificationReadSchema, rawInput ?? {}, "Invalid notification payload");

      const notification = await repository.markNotificationRead(notificationId, context.userId);
      if (!notification) notFound("Notification not found");
      return notification;
    },

    async listFiles(context: RequestContext, boardId: string) {
      await authorizeWorkspaceAction(repository, context, { type: "board", id: boardId }, "read");
      return { files: await repository.listFiles(boardId) };
    },

    async attachFile(context: RequestContext, cardId: string, rawInput: unknown) {
      return repository.transaction(async (transaction) => {
        await authorizeWorkspaceAction(transaction, context, { type: "card", id: cardId }, "write");

        const input = parseInput(attachFileInputSchema, rawInput, "Invalid file attachment") as AttachFileInput;
        const before = await transaction.getCard(cardId);
        if (!before) notFound("Card not found");

        const card = await transaction.attachFile(cardId, input);
        if (!card) notFound("Card not found");
        const workspaceId = await getBoardWorkspaceId(transaction, card.boardId);

        await transaction.recordActivity({
          workspaceId,
          actorId: context.userId,
          action: "card.file.attach",
          objectType: "card",
          objectId: card.id,
          before: cardSnapshot(before),
          after: cardSnapshot(card),
          metadata: { boardId: card.boardId, filename: input.filename }
        });

        return card;
      });
    },

    async searchCards(context: RequestContext, boardId: string, query: string) {
      await authorizeWorkspaceAction(repository, context, { type: "board", id: boardId }, "read");
      return { cards: await repository.searchCards(query, boardId) };
    }
  };
}
