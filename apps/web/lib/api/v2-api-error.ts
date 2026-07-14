export class V2ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "V2ApiError";
  }
}

export async function readV2JsonResponse<T>(
  response: Response,
  failureMessage: string
): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    throw new V2ApiError(response.status, failureMessage, body);
  }
  return body as T;
}
