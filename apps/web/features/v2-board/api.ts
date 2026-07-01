/**
 * Server-side API client for v2 board endpoints.
 * Follows the existing API URL pattern from apps/web/app/boards/[boardId]/page.tsx.
 */
import type {
  V2BoardDetail,
  V2Card,
  V2CardAttachment,
  V2CardVisualStyle,
  V2Connection,
  V2ConnectionAttachment,
  V2CreateCardRequest,
} from "@yadraw/shared";
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
// These call Next.js route handlers (/v2/actions/...) which proxy to
// the backend API with x-yadraw-user-id added server-side.
// V2_USER_ID never reaches the browser.

export async function updateV2CardPosition(
  cardId: string,
  position: { x: number; y: number }
): Promise<void> {
  const response = await fetch(`/v2/actions/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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

export async function updateV2CardSize(
  cardId: string,
  size: { width: number; height: number }
): Promise<void> {
  const response = await fetch(`/v2/actions/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ size }),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Size update failed with ${response.status}`,
      body
    );
  }
}

export async function updateV2CardVisualStyle(
  cardId: string,
  visualStyle: V2CardVisualStyle
): Promise<void> {
  const response = await fetch(`/v2/actions/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ visualStyle }),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Visual style update failed with ${response.status}`,
      body
    );
  }
}

export async function updateV2CardBasics(
  cardId: string,
  input: {
    title?: string;
    description?: string | null;
  }
): Promise<void> {
  const body: { title?: string; description?: string } = {};
  if (input.title !== undefined) body.title = input.title;
  if (input.description !== undefined) body.description = input.description ?? "";

  const response = await fetch(`/v2/actions/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card basics update failed with ${response.status}`,
      body
    );
  }
}

export async function updateV2CardData(
  cardId: string,
  data: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`/v2/actions/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card data update failed with ${response.status}`,
      body
    );
  }
}

export async function createV2Card(
  boardId: string,
  input: V2CreateCardRequest
): Promise<V2Card> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/cards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card creation failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2Card>;
}

export async function deleteV2Card(cardId: string): Promise<void> {
  const response = await fetch(`/v2/actions/cards/${encodeURIComponent(cardId)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card deletion failed with ${response.status}`,
      body
    );
  }
}

export async function duplicateV2Card(cardId: string): Promise<V2Card> {
  const response = await fetch(
    `/v2/actions/cards/${encodeURIComponent(cardId)}/duplicate`,
    { method: "POST", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card duplication failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2Card>;
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
  }
): Promise<V2Connection> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/connections`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        sourcePortKey: input.sourcePortKey,
        targetPortKey: input.targetPortKey,
        type: input.type ?? "data",
        label: input.label ?? "",
      }),
    }
  );
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
  connectionId: string
): Promise<void> {
  const response = await fetch(
    `/v2/actions/connections/${encodeURIComponent(connectionId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
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

export async function updateV2Connection(
  connectionId: string,
  patch: {
    title?: string | null;
    description?: string | null;
    data?: Record<string, unknown>;
  }
): Promise<V2Connection> {
  const response = await fetch(
    `/v2/actions/connections/${encodeURIComponent(connectionId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection update failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2Connection>;
}

export async function listV2CardAttachments(
  cardId: string
): Promise<V2CardAttachment[]> {
  const response = await fetch(
    `/v2/actions/cards/${encodeURIComponent(cardId)}/attachments`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card attachments request failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2CardAttachment[]>;
}

export async function uploadV2CardAttachment(
  cardId: string,
  input: {
    file: File;
    role?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<V2CardAttachment> {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("role", input.role ?? "attachment");
  if (input.metadata) {
    formData.set("metadata", JSON.stringify(input.metadata));
  }

  const response = await fetch(
    `/v2/actions/cards/${encodeURIComponent(cardId)}/attachments`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Attachment upload failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2CardAttachment>;
}

export async function deleteV2CardAttachment(
  cardId: string,
  attachmentId: string
): Promise<void> {
  const response = await fetch(
    `/v2/actions/cards/${encodeURIComponent(cardId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Attachment detach failed with ${response.status}`,
      body
    );
  }
}

export async function listV2ConnectionAttachments(
  connectionId: string
): Promise<V2ConnectionAttachment[]> {
  const response = await fetch(
    `/v2/actions/connections/${encodeURIComponent(connectionId)}/attachments`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection attachments request failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2ConnectionAttachment[]>;
}

export async function uploadV2ConnectionAttachment(
  connectionId: string,
  input: {
    file: File;
    role?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<V2ConnectionAttachment> {
  const formData = new FormData();
  formData.set("file", input.file);
  formData.set("role", input.role ?? "attachment");
  if (input.metadata) {
    formData.set("metadata", JSON.stringify(input.metadata));
  }

  const response = await fetch(
    `/v2/actions/connections/${encodeURIComponent(connectionId)}/attachments`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection attachment upload failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2ConnectionAttachment>;
}

export async function deleteV2ConnectionAttachment(
  connectionId: string,
  attachmentId: string
): Promise<void> {
  const response = await fetch(
    `/v2/actions/connections/${encodeURIComponent(connectionId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection attachment detach failed with ${response.status}`,
      body
    );
  }
}

export function getV2FileDownloadUrl(fileId: string): string {
  return `/v2/actions/files/${encodeURIComponent(fileId)}/download`;
}
