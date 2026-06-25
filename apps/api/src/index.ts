import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import {
  createCardInputSchema,
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
  const input = createCardInputSchema.parse(request.body);
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

server.get("/search", async (request) => {
  const { q = "" } = request.query as { q?: string };
  return { cards: await repository.searchCards(q) };
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await server.listen({ port, host });
