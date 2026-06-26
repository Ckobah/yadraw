import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import { z } from "zod";
import {
  buildCardInputFromTemplate,
  createCardInputSchema,
  demoUserIds,
  updateCardInputSchema
} from "@yadraw/shared";
import { createMemoryRepository, createPostgresRepository } from "./repository.js";

config({ path: new URL("../../../.env", import.meta.url) });
config();

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

function requestUserId(request: { headers: Record<string, unknown> }): string {
  const headerValue = request.headers["x-yadraw-user-id"];
  return typeof headerValue === "string" ? headerValue : demoUserIds.owner;
}

const repository = process.env.DATABASE_URL
  ? await createPostgresRepository(process.env.DATABASE_URL).catch((error: unknown) => {
      server.log.warn({ error }, "PostgreSQL unavailable, falling back to memory repository");
      return createMemoryRepository();
    })
  : createMemoryRepository();

server.get("/health", async () => ({
  ok: true,
  service: "yadraw-api",
  storage: repository.mode
}));

server.get("/boards/:boardId", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  const board = await repository.getBoard(boardId);

  if (!board) {
    return reply.code(404).send({ error: "Board not found" });
  }

  return board;
});

server.post("/boards/:boardId/cards", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  const parsedInput = createCardInputSchema.safeParse(request.body);

  if (!parsedInput.success) {
    return reply.code(400).send({
      error: "Invalid card payload",
      fields: parsedInput.error.flatten().fieldErrors
    });
  }

  const { templateKey, ...cardOverrides } = parsedInput.data;
  let input = cardOverrides;

  if (templateKey) {
    const board = await repository.getBoard(boardId);
    if (!board) {
      return reply.code(404).send({ error: "Board not found" });
    }

    const templateInput = buildCardInputFromTemplate(templateKey, {
      sequence: board.cards.length + 1
    });

    if (!templateInput) {
      return reply.code(400).send({ error: "Unknown card template" });
    }

    input = {
      ...templateInput,
      ...cardOverrides
    };
  }

  const card = await repository.createCard(boardId, input);

  if (!card) {
    return reply.code(404).send({ error: "Board not found" });
  }

  return reply.code(201).send(card);
});

server.patch("/cards/:cardId", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  const patch = updateCardInputSchema.parse(request.body);
  const card = await repository.updateCard(cardId, patch);

  if (!card) {
    return reply.code(404).send({ error: "Card not found" });
  }

  return card;
});

server.delete("/cards/:cardId", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  const card = await repository.deleteCard(cardId);

  if (!card) {
    return reply.code(404).send({ error: "Card not found" });
  }

  return { deleted: true, card };
});

server.post("/cards/:cardId/restore", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  const card = await repository.restoreCard(cardId);

  if (!card) {
    return reply.code(404).send({ error: "Deleted card not found" });
  }

  return card;
});

server.get("/boards/:boardId/trash", async (request) => {
  const { boardId } = request.params as { boardId: string };
  return { cards: await repository.listDeletedCards(boardId) };
});

server.get("/boards/:boardId/card-types", async (request, reply) => {
  const { boardId } = request.params as { boardId: string };
  const templates = await repository.listCardTemplates(boardId);

  if (templates.length === 0) {
    const board = await repository.getBoard(boardId);
    if (!board) {
      return reply.code(404).send({ error: "Board not found" });
    }
  }

  return { templates };
});

server.get("/workspaces/:workspaceId/members", async (request, reply) => {
  const { workspaceId } = request.params as { workspaceId: string };
  const members = await repository.listWorkspaceMembers(workspaceId);

  if (!members) {
    return reply.code(404).send({ error: "Workspace not found" });
  }

  return { members };
});

server.get("/notifications", async (request) => {
  const userId = requestUserId(request);
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
    return reply.code(400).send({
      error: "Invalid notification payload",
      fields: parsedBody.error.flatten().fieldErrors
    });
  }

  const notification = await repository.markNotificationRead(
    notificationId,
    requestUserId(request)
  );

  if (!notification) {
    return reply.code(404).send({ error: "Notification not found" });
  }

  return notification;
});

server.get("/boards/:boardId/files", async (request) => {
  const { boardId } = request.params as { boardId: string };
  return { files: await repository.listFiles(boardId) };
});

server.post("/cards/:cardId/files", async (request, reply) => {
  const { cardId } = request.params as { cardId: string };
  const input = attachFileInputSchema.safeParse(request.body);

  if (!input.success) {
    return reply.code(400).send({
      error: "Invalid file attachment",
      fields: input.error.flatten().fieldErrors
    });
  }

  const card = await repository.attachFile(cardId, input.data);

  if (!card) {
    return reply.code(404).send({ error: "Card not found" });
  }

  return reply.code(201).send(card);
});

server.get("/search", async (request) => {
  const { q = "" } = request.query as { q?: string };
  return { cards: await repository.searchCards(q) };
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await server.listen({ port, host });
