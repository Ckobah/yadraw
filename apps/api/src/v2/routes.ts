import type { FastifyInstance, FastifyReply } from "fastify";
import { V2ServiceError, V2_MAX_ATTACHMENT_BYTES, type V2BoardService } from "./service.js";
import { sendApiError } from "../http.js";

export function registerV2Routes(server: FastifyInstance, service: V2BoardService): void {
  server.get("/v2/status", async (_request, _reply) => {
    return {
      ok: true,
      v2Storage: process.env.YADRAW_V2_STORAGE ?? "v2-postgres",
      legacyRuntimeAllowed: process.env.NODE_ENV !== "production",
      nodeEnv: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
    };
  });
  server.get("/v2/boards/:boardId", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      return await service.getBoard(request.requestContext, boardId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.get("/v2/workspaces/:workspaceId/card-types", async (request, reply) => {
    try {
      const { workspaceId } = request.params as { workspaceId: string };
      return await service.listCardTypes(request.requestContext, workspaceId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.get("/v2/boards/:boardId/field-bindings", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      return await service.listLinkedFieldBindings(request.requestContext, boardId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/boards/:boardId/field-bindings", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      const binding = await service.createLinkedFieldBinding(
        request.requestContext,
        boardId,
        request.body as any
      );
      return reply.code(201).send(binding);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.patch("/v2/boards/:boardId/field-bindings/:bindingId", async (request, reply) => {
    try {
      const { boardId, bindingId } = request.params as {
        boardId: string;
        bindingId: string;
      };
      return await service.updateLinkedFieldBinding(
        request.requestContext,
        boardId,
        bindingId,
        request.body as any
      );
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/boards/:boardId/field-bindings/:bindingId", async (request, reply) => {
    try {
      const { boardId, bindingId } = request.params as {
        boardId: string;
        bindingId: string;
      };
      return await service.deleteLinkedFieldBinding(
        request.requestContext,
        boardId,
        bindingId
      );
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/boards/:boardId/run/dry-run", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      return await service.runBoardDryRun(request.requestContext, boardId, request.body as any);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/boards/:boardId/cards", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      const card = await service.createCard(request.requestContext, boardId, request.body as any);
      return reply.code(201).send(card);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.patch("/v2/cards/:cardId", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      return await service.updateCard(request.requestContext, cardId, request.body as any);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/cards/:cardId/duplicate", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const card = await service.duplicateCard(request.requestContext, cardId);
      return reply.code(201).send(card);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/cards/:cardId", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      return await service.deleteCard(request.requestContext, cardId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/boards/:boardId/connections", async (request, reply) => {
    try {
      const { boardId } = request.params as { boardId: string };
      const connection = await service.createConnection(request.requestContext, boardId, request.body as any);
      return reply.code(201).send(connection);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/connections/:connectionId", async (request, reply) => {
    try {
      const { connectionId } = request.params as { connectionId: string };
      return await service.deleteConnection(request.requestContext, connectionId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.patch("/v2/connections/:connectionId", async (request, reply) => {
    try {
      const { connectionId } = request.params as { connectionId: string };
      return await service.updateConnection(request.requestContext, connectionId, request.body as any);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.get("/v2/connections/:connectionId/attachments", async (request, reply) => {
    try {
      const { connectionId } = request.params as { connectionId: string };
      return await service.listConnectionAttachments(request.requestContext, connectionId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/connections/:connectionId/attachments", async (request, reply) => {
    try {
      const { connectionId } = request.params as { connectionId: string };
      const input = await readAttachmentUpload(request);
      const attachment = await service.uploadConnectionAttachment(
        request.requestContext,
        connectionId,
        input
      );
      return reply.code(201).send(attachment);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/connections/:connectionId/attachments/:attachmentId", async (request, reply) => {
    try {
      const { connectionId, attachmentId } = request.params as {
        connectionId: string;
        attachmentId: string;
      };
      await service.detachConnectionAttachment(
        request.requestContext,
        connectionId,
        attachmentId
      );
      return reply.code(204).send();
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.get("/v2/cards/:cardId/attachments", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      return await service.listCardAttachments(request.requestContext, cardId);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.post("/v2/cards/:cardId/attachments", async (request, reply) => {
    try {
      const { cardId } = request.params as { cardId: string };
      const input = await readAttachmentUpload(request);
      const attachment = await service.uploadCardAttachment(
        request.requestContext,
        cardId,
        input
      );
      return reply.code(201).send(attachment);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.get("/v2/files/:fileId/download", async (request, reply) => {
    try {
      const { fileId } = request.params as { fileId: string };
      const result = await service.downloadFile(request.requestContext, fileId);
      reply.header("Content-Type", result.mimeType ?? "application/octet-stream");
      if (result.sizeBytes !== null && result.sizeBytes !== undefined) {
        reply.header("Content-Length", String(result.sizeBytes));
      }
      reply.header("Content-Disposition", buildAttachmentContentDisposition(result.filename));
      return reply.send(result.object.body);
    } catch (error) {
      return handleV2ServiceError(reply, error);
    }
  });

  server.delete("/v2/cards/:cardId/attachments/:attachmentId", async (request, reply) => {
    try {
      const { cardId, attachmentId } = request.params as {
        cardId: string;
        attachmentId: string;
      };
      await service.detachCardAttachment(request.requestContext, cardId, attachmentId);
      return reply.code(204).send();
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
      case "forbidden":
        return sendApiError(reply, 403, "forbidden", error.message);
      case "storage_unavailable":
        return sendApiError(reply, 503, "service_unavailable", error.message);
    }
  }

  throw error;
}

type UploadInput = {
  filename: string;
  body: Buffer;
  mimeType?: string | null;
  role?: string;
  metadata?: Record<string, unknown>;
};

async function readAttachmentUpload(request: any): Promise<UploadInput> {
  if (!request.isMultipart?.()) {
    throw new V2ServiceError("validation_failed", "Expected multipart/form-data");
  }

  let file:
    | {
        filename: string;
        body: Buffer;
        mimeType?: string | null;
      }
    | null = null;
  let role: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "file") {
        part.file.resume();
        continue;
      }
      if (file) {
        part.file.resume();
        throw new V2ServiceError("validation_failed", "Only one file is allowed");
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of part.file) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > V2_MAX_ATTACHMENT_BYTES) {
          throw new V2ServiceError("validation_failed", "File exceeds 25MB limit");
        }
        chunks.push(buffer);
      }

      file = {
        filename: part.filename || "file",
        body: Buffer.concat(chunks),
        mimeType: part.mimetype || "application/octet-stream"
      };
      continue;
    }

    if (part.fieldname === "role") {
      role = String(part.value ?? "");
      continue;
    }

    if (part.fieldname === "metadata") {
      metadata = parseMetadataField(part.value);
    }
  }

  if (!file) {
    throw new V2ServiceError("validation_failed", "File is required");
  }

  return {
    ...file,
    ...(role !== undefined ? { role } : {}),
    ...(metadata !== undefined ? { metadata } : {})
  };
}

function parseMetadataField(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new V2ServiceError("validation_failed", "metadata must be a valid JSON object");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new V2ServiceError("validation_failed", "metadata must be a valid JSON object");
  }

  return parsed as Record<string, unknown>;
}

function buildAttachmentContentDisposition(filename: string): string {
  const cleanFilename = filename.replace(/[\r\n]/g, " ").trim() || "download";
  const fallbackFilename = buildAsciiFallbackFilename(cleanFilename);
  return `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeRfc5987Value(cleanFilename)}`;
}

function buildAsciiFallbackFilename(filename: string): string {
  const extensionMatch = filename.match(/\.([A-Za-z0-9]{1,12})$/);
  const extension = extensionMatch ? `.${extensionMatch[1]}` : "";

  if (/[^\x20-\x7E]/.test(filename)) {
    return `download${extension}`;
  }

  const fallback = filename
    .replace(/["\\]/g, "_")
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._ -]+|[._ -]+$/g, "")
    .slice(0, 120);

  return fallback || `download${extension}`;
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}
