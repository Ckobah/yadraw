import cors from "@fastify/cors";
import { config } from "dotenv";
import Fastify from "fastify";
import type { RequestContext } from "./context.js";
import { getRequestContext } from "./context.js";
import { sendApiError } from "./http.js";
import { V2ServiceError, createV2BoardService } from "./v2/service.js";
import { createV2PostgresRepository } from "./v2/repository.js";
import { registerV2Routes } from "./v2/routes.js";
import { validateV2RuntimeConfig } from "./v2/config.js";

config({ path: new URL("../../../.env", import.meta.url) });
config();

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}

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

function readV2StorageMode(): "v2-postgres" | "memory" {
  const mode = process.env.YADRAW_V2_STORAGE ?? "v2-postgres";

  if (mode !== "v2-postgres" && mode !== "memory") {
    throw new Error(
      "YADRAW_V2_STORAGE must be 'v2-postgres' or 'memory'"
    );
  }

  validateV2RuntimeConfig(process.env.NODE_ENV, mode);

  return mode;
}

async function createV2Repository() {
  const v2StorageMode = readV2StorageMode();

  if (v2StorageMode === "memory") {
    server.log.warn("Using v2 in-memory storage.");
    const { createV2MemoryRepository } = await import("./v2/repository.js");
    return createV2MemoryRepository();
  }

  // v2-postgres (default) — strict v2 schema
  if (!process.env.V2_DATABASE_URL) {
    throw new Error("V2_DATABASE_URL is required when YADRAW_V2_STORAGE=v2-postgres");
  }
  return createV2PostgresRepository(process.env.V2_DATABASE_URL);
}

// Create v2 service and register v2 routes
const v2Repository = await createV2Repository();
const v2Service = createV2BoardService(v2Repository);
registerV2Routes(server, v2Service);

server.setErrorHandler((error, request, reply) => {
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
    }
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

server.get("/health", async () => ({ ok: true, service: "yadraw-api", storage: "v2-postgres" }));

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "127.0.0.1";

await server.listen({ port, host });
