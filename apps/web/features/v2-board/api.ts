/**
 * Server-side API client for v2 board endpoints.
 * Follows the existing API URL pattern from apps/web/app/boards/[boardId]/page.tsx.
 */
import type { V2BoardDetail, V2Connection } from "@yadraw/shared";
import type { V2CardType } from "@yadraw/shared";

const apiBaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000";

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

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // In production, the v2 API requires x-yadraw-user-id for auth context.
  // In development, the API falls back to DEV_USER_ID env var.
  const userId = process.env.V2_USER_ID;
  if (userId) {
    headers["x-yadraw-user-id"] = userId;
  }

  return headers;
}

export async function fetchV2Board(boardId: string): Promise<V2BoardDetail> {
  const url = `${apiBaseUrl}/v2/boards/${encodeURIComponent(boardId)}`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // ignore parse errors
    }
    throw new V2ApiError(
      response.status,
      `Board request failed with ${response.status}`,
      body
    );
  }

  return response.json() as Promise<V2BoardDetail>;
}

export async function fetchV2CardTypes(
  workspaceId: string
): Promise<V2CardType[]> {
  const url = `${apiBaseUrl}/v2/workspaces/${encodeURIComponent(workspaceId)}/card-types`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // ignore parse errors
    }
    throw new V2ApiError(
      response.status,
      `Card types request failed with ${response.status}`,
      body
    );
  }

  const data = (await response.json()) as { cardTypes?: V2CardType[] };
  return data.cardTypes ?? [];
}

// ── Client-side API helpers ───────────────────────────────────────
// These functions accept an explicit userId parameter for browser use
// (V2_USER_ID is only available server-side via process.env).

function clientHeaders(userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  if (userId) {
    headers["x-yadraw-user-id"] = userId;
  }
  return headers;
}

export async function updateV2CardPosition(
  cardId: string,
  position: { x: number; y: number },
  userId?: string
): Promise<void> {
  const url = `${apiBaseUrl}/v2/cards/${encodeURIComponent(cardId)}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...clientHeaders(userId) },
    body: JSON.stringify({ position }),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Position update failed with ${response.status}`,
      body
    );
  }
}

export async function createV2Connection(
  boardId: string,
  input: {
    sourceCardId: string;
    targetCardId: string;
    sourcePortKey: string;
    targetPortKey: string;
    type?: string;
    label?: string;
  },
  userId?: string
): Promise<V2Connection> {
  const url = `${apiBaseUrl}/v2/boards/${encodeURIComponent(boardId)}/connections`;
  const response = await fetch(url, {
    method: "POST",
    headers: { ...clientHeaders(userId) },
    body: JSON.stringify({
      sourceCardId: input.sourceCardId,
      targetCardId: input.targetCardId,
      sourcePortKey: input.sourcePortKey,
      targetPortKey: input.targetPortKey,
      type: input.type ?? "data",
      label: input.label ?? "",
    }),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection creation failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2Connection>;
}

export async function deleteV2Connection(
  connectionId: string,
  userId?: string
): Promise<void> {
  const url = `${apiBaseUrl}/v2/connections/${encodeURIComponent(connectionId)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: { ...clientHeaders(userId) },
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection deletion failed with ${response.status}`,
      body
    );
  }
}
