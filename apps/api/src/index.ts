import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import {
  buildCardInputFromTemplate,
  createCardInputSchema,
  updateCardInputSchema
} from "@yadraw/shared";
import type { RequestContext } from "./context.js";
import { getRequestContext } from "./context.js";
import { type AccessLevel, hasWorkspaceAccess } from "./authorization.js";
import { sendApiError, sendInvalidPayload } from "./http.js";
import { createMemoryRepository, createPostgresRepository } from "./repository.js";

config({ path: new URL("../../../.env", import.meta.url) });
config();

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}

type StorageMode = "postgres" | "memory";

const server = Fastify({
  logger: true
});

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://127.0.0.1:3000,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

await server.register(cors, {
  origin: corsOrigins
});

const attachFileInputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(1).max(120).optional(),
  sizeBytes: z.number().int().nonnegative().max(25_000_000).optional(),
  role: z.string().trim().min(1).max(60).default("attachment")
});

const markNotificationReadSchema = z.object({}).strict();

function readStorageMode(): StorageMode {
  const storageMode = process.env.YADRAW_STORAGE ?? "postgres";

  if (storageMode !== "postgres" && storageMode !== "memory") {
    throw new Error("YADRAW_STORAGE must be either 'postgres' or 'memory'");
  }

  if (process.env.NODE_ENV === "production" && storageMode === "memory") {
    throw new Error("YADRAW_STORAGE=memory is not allowed in production");
  }

  return storageMode;
}

async function createRepository() {
  const storageMode = readStorageMode();

  if (storageMode === "memory") {
    server.log.warn("Using explicit in-memory storage. Data will not persist after API restart.");
    return createMemoryRepository();
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when YADRAW_STORAGE=postgres");
  }

  return createPostgresRepository(process.env.DATABASE_URL);
}

const repository = await createRepository();

async function requireBoardAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  boardId: string,
  accessLevel: AccessLevel
): Promise<boolean> {
  const role = await repository.getBoardRole(request.requestContext.userId, boardId);
  if (hasWorkspaceAccess(role, accessLevel)) return true;

  sendApiError(reply, 403, "forbidden", "Forbidden");
  return false;
}

async function requireCardAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  cardId: string,
  accessLevel: AccessLevel
): Promise<boolean> {
  const role = await repository.getCardRole(request.requestContext.userId, cardId);
  if (hasWorkspaceAccess(role, accessLevel)) return true;

  sendApiError(reply, 403, "forbidden", "Forbidden");
  return false;
}

async function requireWorkspaceAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
  accessLevel: AccessLevel
): Promise<boolean> {
  const role = await repository.getWorkspaceRole(request.requestContext.userId, workspaceId);
  if (hasWorkspaceAccess(role, accessLevel)) return true;

  sendApiError(reply, 403, "forbidden", "Forbidden");
  return false;
}

server.setErrorHandler((error, request, reply) => {
  request.log.error({ error }, "Unhandled API error");
  return sendApiError(reply, 500, "internal_error", "Internal server error");
});

server.addHook("preHandler", async (request, reply) => {
  if (request.method === "OPTIONS" || request.routeOptions.url === "/health") {
    return;
  }

  const requestContext = getRequestContext(request);
  if (!requestContext) {
    return sendApiError(reply, 401, "unauthorized", "Missing or invalid user context");
  }

  request.requestContext = requestContext;
});

server.get("/health", async () => ({
  ok: true,
  service: "yadraw-api",
  storage: repository.mode
}));

server.get("/boards/:boardId", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  if (!(await requireBoardAccess(request, reply, boardId, "read"))) return;

  const board = await repository.getBoard(boardId);

  if (!board) {
    return sendApiError(reply, 404, "not_found", "Board not found");
  }

  return board;
});

server.post("/boards/:boardId/cards", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  if (!(await requireBoardAccess(request, reply, boardId, "write"))) return;

  const parsedInput = createCardInputSchema.safeParse(request.body);

  if (!parsedInput.success) {
    return sendInvalidPayload(reply, "Invalid card payload", parsedInput.error);
  }

  const { templateKey, ...cardOverrides } = parsedInput.data;
  let input = cardOverrides;

  if (templateKey) {
    const board = await repository.getBoard(boardId);
    if (!board) {
      return sendApiError(reply, 404, "not_found", "Board not found");
    }

    const templateInput = buildCardInputFromTemplate(templateKey, {
      sequence: board.cards.length + 1
    });

    if (!templateInput) {
      return sendApiError(reply, 400, "bad_request", "Unknown card template");
    }

    input = {
      ...templateInput,
      ...cardOverrides
    };
  }

  const card = await repository.createCard(boardId, input);

  if (!card) {
    return sendApiError(reply, 404, "not_found", "Board not found");
  }

  return reply.code(201).send(card);
});

server.patch("/cards/:cardId", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  if (!(await requireCardAccess(request, reply, cardId, "write"))) return;

  const parsedPatch = updateCardInputSchema.safeParse(request.body);
  if (!parsedPatch.success) {
    return sendInvalidPayload(reply, "Invalid card payload", parsedPatch.error);
  }

  const patch = parsedPatch.data;
  const card = await repository.updateCard(cardId, patch);

  if (!card) {
    return sendApiError(reply, 404, "not_found", "Card not found");
  }

  return card;
});

server.delete("/cards/:cardId", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  if (!(await requireCardAccess(request, reply, cardId, "write"))) return;

  const card = await repository.deleteCard(cardId);

  if (!card) {
    return sendApiError(reply, 404, "not_found", "Card not found");
  }

  return { deleted: true, card };
});

server.post("/cards/:cardId/restore", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  if (!(await requireCardAccess(request, reply, cardId, "write"))) return;

  const card = await repository.restoreCard(cardId);

  if (!card) {
    return sendApiError(reply, 404, "not_found", "Deleted card not found");
  }

  return card;
});

server.get("/boards/:boardId/trash", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  if (!(await requireBoardAccess(request, reply, boardId, "read"))) return;

  return { cards: await repository.listDeletedCards(boardId) };
});

server.get("/boards/:boardId/card-types", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  if (!(await requireBoardAccess(request, reply, boardId, "read"))) return;

  const templates = await repository.listCardTemplates(boardId);

  if (templates.length === 0) {
    const board = await repository.getBoard(boardId);
    if (!board) {
      return sendApiError(reply, 404, "not_found", "Board not found");
    }
  }

  return { templates };
});

server.get("/workspaces/:workspaceId/members", async (request, reply) => {
  const { workspaceId } = request.params as { workspaceId: string };
  if (!(await requireWorkspaceAccess(request, reply, workspaceId, "read"))) return;

  const members = await repository.listWorkspaceMembers(workspaceId);

  if (!members) {
    return sendApiError(reply, 404, "not_found", "Workspace not found");
  }

  return { members };
});

server.get("/notifications", async (request) => {
  const userId = request.requestContext.userId;
  const notifications = await repository.listNotifications(userId);
  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.readAt).length
  };
});

server.patch("/notifications/:notificationId/read", async (request, reply) => {
  const { notificationId } = request.params as { notificationId: string };
  const parsedBody = markNotificationReadSchema.safeParse(request.body ?? {});

  if (!parsedBody.success) {
    return sendInvalidPayload(reply, "Invalid notification payload", parsedBody.error);
  }

  const notification = await repository.markNotificationRead(
    notificationId,
    request.requestContext.userId
  );

  if (!notification) {
    return sendApiError(reply, 404, "not_found", "Notification not found");
  }

  return notification;
});

server.get("/boards/:boardId/files", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  if (!(await requireBoardAccess(request, reply, boardId, "read"))) return;

  return { files: await repository.listFiles(boardId) };
});

server.post("/cards/:cardId/files", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  if (!(await requireCardAccess(request, reply, cardId, "write"))) return;

  const input = attachFileInputSchema.safeParse(request.body);

  if (!input.success) {
    return sendInvalidPayload(reply, "Invalid file attachment", input.error);
  }

  const card = await repository.attachFile(cardId, input.data);

  if (!card) {
    return sendApiError(reply, 404, "not_found", "Card not found");
  }

  return reply.code(201).send(card);
});

async function searchBoardCards(
  request: FastifyRequest,
  reply: FastifyReply,
  boardId: string,
  query: string
) {
  if (!(await requireBoardAccess(request, reply, boardId, "read"))) return;

  return { cards: await repository.searchCards(query, boardId) };
}

server.get("/boards/:boardId/search", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  const { q = "" } = request.query as { q?: string };
  return searchBoardCards(request, reply, boardId, q);
});

server.get("/search", async (request, reply) => {
  const { q = "", boardId } = request.query as { q?: string; boardId?: string };
  if (!boardId) {
    return sendApiError(reply, 400, "bad_request", "boardId is required");
  }

  return searchBoardCards(request, reply, boardId, q);
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await server.listen({ port, host });
