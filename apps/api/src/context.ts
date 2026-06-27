import type { FastifyRequest } from "fastify";
import { uuidSchema } from "@yadraw/shared";

export type RequestContext = {
  userId: string;
  source: "header" | "dev";
};

type RequestHeaders = Pick<FastifyRequest, "headers">;
type ContextEnvironment = {
  DEV_USER_ID?: string;
  NODE_ENV?: string;
};

function firstHeaderValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  return undefined;
}

function parseUserId(value: string | undefined): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getRequestContext(
  request: RequestHeaders,
  environment: ContextEnvironment = process.env
): RequestContext | null {
  const headerUserId = parseUserId(firstHeaderValue(request.headers["x-yadraw-user-id"]));
  if (headerUserId) {
    return {
      userId: headerUserId,
      source: "header"
    };
  }

  if (environment.NODE_ENV !== "production") {
    const devUserId = parseUserId(environment.DEV_USER_ID);
    if (devUserId) {
      return {
        userId: devUserId,
        source: "dev"
      };
    }
  }

  return null;
}
