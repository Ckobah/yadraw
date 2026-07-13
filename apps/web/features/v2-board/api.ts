import type {
  V2Card,
  V2CardAttachment,
  V2CardType,
  V2CardTypeSchema,
  V2CardVisualStyle,
  V2CalculationEvaluation,
  V2Connection,
  V2ConnectionAttachment,
  V2ConnectionType,
  V2ConnectionVisualStyle,
  V2CreateLinkedFieldBindingRequest,
  V2CreateCardTypeRequest,
  V2CreateCardRequest,
  V2CreateConnectionTypeRequest,
  V2DryRunResult,
  V2LinkedFieldBinding,
  V2LinkedFieldBindingListResponse,
  V2UpdateCardTypeRequest,
  V2UpdateBoardLayoutRequest,
  V2UpdateBoardLayoutResponse,
  V2UpdateConnectionTypeRequest,
  V2UpdateLinkedFieldBindingRequest,
} from "@yadraw/shared";

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

// ── Client-side API helpers ───────────────────────────────────────
// These call Next.js route handlers (/v2/actions/...) which proxy to
// the backend API with user context added server-side.

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

export async function createV2CardType(
  boardId: string,
  input: V2CreateCardTypeRequest
): Promise<V2CardType> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/card-types`,
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
      `Card type creation failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2CardType>;
}

export async function updateV2CardType(
  boardId: string,
  cardTypeId: string,
  input: V2UpdateCardTypeRequest
): Promise<V2CardType> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/card-types/${encodeURIComponent(cardTypeId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card type update failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2CardType>;
}

export async function updateV2CardTypeSchema(
  boardId: string,
  cardTypeId: string,
  schema: V2CardTypeSchema
): Promise<V2CardType> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/card-types/${encodeURIComponent(cardTypeId)}/schema`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ schema }),
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card type schema update failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2CardType>;
}

export async function updateV2BoardLayout(
  boardId: string,
  input: V2UpdateBoardLayoutRequest
): Promise<V2UpdateBoardLayoutResponse> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/layout`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input)
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(response.status, `Layout update failed with ${response.status}`, body);
  }
  return response.json() as Promise<V2UpdateBoardLayoutResponse>;
}

export async function deleteV2CardType(
  boardId: string,
  cardTypeId: string
): Promise<void> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/card-types/${encodeURIComponent(cardTypeId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Card type deletion failed with ${response.status}`,
      body
    );
  }
}

export async function createV2ConnectionType(
  boardId: string,
  input: V2CreateConnectionTypeRequest
): Promise<V2ConnectionType> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/connection-types`,
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
      `Connection type creation failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2ConnectionType>;
}

export async function updateV2ConnectionType(
  boardId: string,
  connectionTypeId: string,
  input: V2UpdateConnectionTypeRequest
): Promise<V2ConnectionType> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/connection-types/${encodeURIComponent(connectionTypeId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Connection type update failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2ConnectionType>;
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
    connectionTypeId?: string | null;
    sourceCardId: string;
    targetCardId: string;
    sourcePortKey: string;
    targetPortKey: string;
    type?: string;
    label?: string;
    data?: Record<string, unknown>;
    visualStyle?: V2ConnectionVisualStyle;
  }
): Promise<V2Connection> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/connections`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        ...(input.connectionTypeId !== undefined ? { connectionTypeId: input.connectionTypeId } : {}),
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        sourcePortKey: input.sourcePortKey,
        targetPortKey: input.targetPortKey,
        type: input.type ?? "data",
        label: input.label ?? "",
        ...(input.data !== undefined ? { data: input.data } : {}),
        ...(input.visualStyle !== undefined ? { visualStyle: input.visualStyle } : {}),
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

export async function evaluateV2BoardCalculations(
  boardId: string,
  input: { overrides?: Array<{ cardId: string; patch: Record<string, unknown> }> } = {}
): Promise<V2CalculationEvaluation> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/calculations/evaluate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input)
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Calculation request failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2CalculationEvaluation>;
}

export async function runV2BoardDryRun(
  boardId: string,
  input: { startCardId?: string } = {}
): Promise<V2DryRunResult> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/run/dry-run`,
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
      `Dry-run request failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2DryRunResult>;
}

export async function listV2LinkedFieldBindings(
  boardId: string
): Promise<V2LinkedFieldBinding[]> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/field-bindings`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Linked field bindings request failed with ${response.status}`,
      body
    );
  }
  const data = (await response.json()) as V2LinkedFieldBindingListResponse;
  return data.fieldBindings;
}

export async function createV2LinkedFieldBinding(
  boardId: string,
  input: V2CreateLinkedFieldBindingRequest
): Promise<V2LinkedFieldBinding> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/field-bindings`,
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
      `Linked field binding creation failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2LinkedFieldBinding>;
}

export async function updateV2LinkedFieldBinding(
  boardId: string,
  bindingId: string,
  input: V2UpdateLinkedFieldBindingRequest
): Promise<V2LinkedFieldBinding> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/field-bindings/${encodeURIComponent(bindingId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Linked field binding update failed with ${response.status}`,
      body
    );
  }
  return response.json() as Promise<V2LinkedFieldBinding>;
}

export async function deleteV2LinkedFieldBinding(
  boardId: string,
  bindingId: string
): Promise<void> {
  const response = await fetch(
    `/v2/actions/boards/${encodeURIComponent(boardId)}/field-bindings/${encodeURIComponent(bindingId)}`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { /* ignore */ }
    throw new V2ApiError(
      response.status,
      `Linked field binding deletion failed with ${response.status}`,
      body
    );
  }
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
    connectionTypeId?: string | null;
    sourceCardId?: string;
    targetCardId?: string;
    sourcePortKey?: string;
    targetPortKey?: string;
    data?: Record<string, unknown>;
    visualStyle?: V2ConnectionVisualStyle;
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
