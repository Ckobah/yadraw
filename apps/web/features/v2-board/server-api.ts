import "server-only";

import type { V2BoardDetail, V2CalculationEvaluation, V2CardType } from "@yadraw/shared";
import { getCurrentV2User } from "../../lib/auth/current-user";
import { buildInternalApiHeaders } from "../../lib/api/internal-api";

import { V2ApiError } from "./api";

const apiBaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000";

async function buildHeaders(): Promise<Record<string, string>> {
  const user = await getCurrentV2User();
  if (!user) throw new V2ApiError(401, "Authentication required");
  return {
    Accept: "application/json",
    ...buildInternalApiHeaders(user.id)
  };
}

export async function fetchV2Board(boardId: string): Promise<V2BoardDetail> {
  const url = `${apiBaseUrl}/v2/boards/${encodeURIComponent(boardId)}`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: await buildHeaders(),
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

export async function fetchV2CalculationEvaluation(
  boardId: string
): Promise<V2CalculationEvaluation> {
  const url = `${apiBaseUrl}/v2/boards/${encodeURIComponent(boardId)}/calculations/evaluate`;
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...(await buildHeaders()),
      "Content-Type": "application/json"
    },
    body: "{}"
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
      `Calculation request failed with ${response.status}`,
      body
    );
  }

  return response.json() as Promise<V2CalculationEvaluation>;
}

export async function fetchV2CardTypes(
  workspaceId: string
): Promise<V2CardType[]> {
  const url = `${apiBaseUrl}/v2/workspaces/${encodeURIComponent(workspaceId)}/card-types`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: await buildHeaders(),
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
