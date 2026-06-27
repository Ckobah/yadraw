import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "forbidden"
  | "internal_error"
  | "invalid_payload"
  | "not_found"
  | "unauthorized";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string[] | undefined>;
  };
};

export function errorBody(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string[] | undefined>
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(fields ? { fields } : {})
    }
  };
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string[] | undefined>
) {
  return reply.code(statusCode).send(errorBody(code, message, fields));
}

export function sendInvalidPayload(reply: FastifyReply, message: string, error: ZodError) {
  return sendApiError(reply, 400, "invalid_payload", message, error.flatten().fieldErrors);
}
