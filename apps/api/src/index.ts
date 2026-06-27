import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import type { RequestContext } from "./context.js";
import { getRequestContext } from "./context.js";
import { createBoardCore } from "./core/board-service.js";
import { CoreError } from "./core/errors.js";
import { sendApiError } from "./http.js";
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
const core = createBoardCore(repository);

server.setErrorHandler((error, request, reply) => {
  if (error instanceof CoreError) {
    return sendApiError(reply, error.statusCode, error.code, error.message, error.fields);
  }

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

server.get("/health", async () => core.getHealth());

server.get("/boards/:boardId", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  return core.getBoard(request.requestContext, boardId);
});

server.post("/boards/:boardId/cards", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  const card = await core.createCard(request.requestContext, boardId, request.body);
  return reply.code(201).send(card);
});

server.patch("/cards/:cardId", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  return core.updateCard(request.requestContext, cardId, request.body);
});

server.delete("/cards/:cardId", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  return core.deleteCard(request.requestContext, cardId);
});

server.post("/cards/:cardId/restore", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  return core.restoreCard(request.requestContext, cardId);
});

server.get("/boards/:boardId/trash", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  return core.listDeletedCards(request.requestContext, boardId);
});

server.get("/boards/:boardId/card-types", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  return core.listCardTemplates(request.requestContext, boardId);
});

server.get("/workspaces/:workspaceId/members", async (request, reply) => {
  const { workspaceId } = request.params as { workspaceId: string };
  return core.listWorkspaceMembers(request.requestContext, workspaceId);
});

server.get("/notifications", async (request) => core.listNotifications(request.requestContext));

server.patch("/notifications/:notificationId/read", async (request, reply) => {
  const { notificationId } = request.params as { notificationId: string };
  return core.markNotificationRead(request.requestContext, notificationId, request.body);
});

server.get("/boards/:boardId/files", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  return core.listFiles(request.requestContext, boardId);
});

server.post("/cards/:cardId/files", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  const card = await core.attachFile(request.requestContext, cardId, request.body);
  return reply.code(201).send(card);
});

server.get("/boards/:boardId/search", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  const { q = "" } = request.query as { q?: string };
  return core.searchCards(request.requestContext, boardId, q);
});

server.get("/search", async (request, reply) => {
  const { q = "", boardId } = request.query as { q?: string; boardId?: string };
  if (!boardId) {
    return sendApiError(reply, 400, "bad_request", "boardId is required");
  }

  return core.searchCards(request.requestContext, boardId, q);
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await server.listen({ port, host });
