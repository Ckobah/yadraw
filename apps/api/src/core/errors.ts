import type { ApiErrorCode } from "../http.js";

export type CoreErrorCode = ApiErrorCode;

export class CoreError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: CoreErrorCode,
    message: string,
    readonly fields?: Record<string, string[] | undefined>
  ) {
    super(message);
    this.name = "CoreError";
  }
}

export function badRequest(message: string): never {
  throw new CoreError(400, "bad_request", message);
}

export function forbidden(message = "Forbidden"): never {
  throw new CoreError(403, "forbidden", message);
}

export function invalidPayload(
  message: string,
  fields?: Record<string, string[] | undefined>
): never {
  throw new CoreError(400, "invalid_payload", message, fields);
}

export function notFound(message: string): never {
  throw new CoreError(404, "not_found", message);
}
