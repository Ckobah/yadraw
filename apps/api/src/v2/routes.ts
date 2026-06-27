import type { FastifyInstance, FastifyReply } from "fastify";
import { V2ServiceError, type V2BoardService } from "./service.js";
import { sendApiError } from "../http.js";

export function registerV2Routes(server: FastifyInstance, service: V2BoardService): void {
  server.get("/v2/boards/:boardId", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      return await service.getBoard(boardId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.get("/v2/workspaces/:workspaceId/card-types", async (request, reply) => {
    try {
      const { workspaceId } = request.params as { workspaceId: string };
      return await service.listCardTypes(workspaceId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/boards/:boardId/cards", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      const card = await service.createCard(boardId, request.body as any);
      return reply.code(201).send(card);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.patch("/v2/cards/:cardId", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      return await service.updateCard(cardId, request.body as any);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/cards/:cardId", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      return await service.deleteCard(cardId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/boards/:boardId/connections", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      const connection = await service.createConnection(boardId, request.body as any);
      return reply.code(201).send(connection);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/connections/:connectionId", async (request, reply) => {
    try {
      const { connectionId } = request.params as { connectionId: string };
      return await service.deleteConnection(connectionId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });
}

function handleV2ServiceError(reply: FastifyReply, error: unknown) {
  if (error instanceof V2ServiceError) {
    switch (error.code) {
      case "not_found":
        return sendApiError(reply, 404, "not_found", error.message);
      case "validation_failed":
        return sendApiError(reply, 400, "invalid_payload", error.message);
      case "conflict":
        return sendApiError(reply, 409, "conflict", error.message);
    }
  }

  throw error;
}
