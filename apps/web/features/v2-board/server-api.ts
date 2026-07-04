import "server-only";

import type { V2BoardDetail, V2CardType } from "@yadraw/shared";

import { V2ApiError } from "./api";

const apiBaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000";

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
