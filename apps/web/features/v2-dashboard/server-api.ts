import "server-only";

import type {
  V2BootstrapSessionResponse,
  V2ListWorkspaceBoardsResponse,
  V2ListWorkspacesResponse
} from "@yadraw/shared";
import type { CurrentV2User } from "../../lib/auth/current-user";
import { buildInternalApiHeaders } from "../../lib/api/internal-api";

const apiBaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000";

async function requestApi<T>(
  user: CurrentV2User,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...buildInternalApiHeaders(user.id),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Dashboard API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function bootstrapCurrentUser(user: CurrentV2User) {
  return requestApi<V2BootstrapSessionResponse>(user, "/v2/session/bootstrap", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      authProvider: user.authProvider
    })
  });
}

export async function fetchCurrentWorkspaces(user: CurrentV2User) {
  const result = await requestApi<V2ListWorkspacesResponse>(user, "/v2/workspaces");
  return result.workspaces;
}

export async function fetchWorkspaceBoards(user: CurrentV2User, workspaceId: string) {
  const result = await requestApi<V2ListWorkspaceBoardsResponse>(
    user,
    `/v2/workspaces/${encodeURIComponent(workspaceId)}/boards`
  );
  return result.boards;
}
