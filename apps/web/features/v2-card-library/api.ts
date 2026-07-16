import type {
  V2Card,
  V2CardLibraryEntry,
  V2CardLibraryEntryListResponse,
  V2CreateCardLibraryEntryRequest,
  V2CsvLibraryImportCommitRequest,
  V2CsvLibraryImportPreview,
  V2CsvLibraryImportPreviewRequest,
  V2CsvLibraryImportResult,
  V2ListCardLibraryEntriesQueryRequest,
  V2SetCardLibraryEntryRequest,
  V2UpdateCardLibraryEntryRequest
} from "@yadraw/shared";
import { readV2JsonResponse } from "../../lib/api/v2-api-error";

export { V2ApiError } from "../../lib/api/v2-api-error";

function collectionUrl(workspaceId: string, cardTypeId: string): string {
  return `/v2/actions/workspaces/${encodeURIComponent(workspaceId)}/card-types/${encodeURIComponent(cardTypeId)}/library-entries`;
}

function entryUrl(
  workspaceId: string,
  cardTypeId: string,
  libraryEntryId: string
): string {
  return `${collectionUrl(workspaceId, cardTypeId)}/${encodeURIComponent(libraryEntryId)}`;
}

function csvImportUrl(
  workspaceId: string,
  cardTypeId: string,
  action: "preview" | "commit"
): string {
  return `${collectionUrl(workspaceId, cardTypeId)}?csvImport=${action}`;
}

export async function listV2CardLibraryEntries(
  workspaceId: string,
  cardTypeId: string,
  query: V2ListCardLibraryEntriesQueryRequest = {},
  options: { signal?: AbortSignal } = {}
): Promise<V2CardLibraryEntryListResponse> {
  const searchParams = new URLSearchParams();
  if (query.query !== undefined) searchParams.set("query", query.query);
  if (query.status !== undefined) searchParams.set("status", query.status);
  if (query.cursor !== undefined) searchParams.set("cursor", query.cursor);
  if (query.limit !== undefined) searchParams.set("limit", String(query.limit));
  if (query.sort !== undefined) searchParams.set("sort", query.sort);
  if (query.direction !== undefined) searchParams.set("direction", query.direction);
  const serializedQuery = searchParams.toString();
  const url = `${collectionUrl(workspaceId, cardTypeId)}${
    serializedQuery ? `?${serializedQuery}` : ""
  }`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: options.signal
  });
  return readV2JsonResponse<V2CardLibraryEntryListResponse>(
    response,
    `Card library request failed with ${response.status}`
  );
}

export async function getV2CardLibraryEntry(
  workspaceId: string,
  cardTypeId: string,
  libraryEntryId: string
): Promise<V2CardLibraryEntry> {
  const response = await fetch(entryUrl(workspaceId, cardTypeId, libraryEntryId), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  return readV2JsonResponse<V2CardLibraryEntry>(
    response,
    `Card library entry request failed with ${response.status}`
  );
}

export async function createV2CardLibraryEntry(
  workspaceId: string,
  cardTypeId: string,
  input: V2CreateCardLibraryEntryRequest
): Promise<V2CardLibraryEntry> {
  const response = await fetch(collectionUrl(workspaceId, cardTypeId), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readV2JsonResponse<V2CardLibraryEntry>(
    response,
    `Card library entry creation failed with ${response.status}`
  );
}

export async function previewV2CsvLibraryImport(
  workspaceId: string,
  cardTypeId: string,
  input: V2CsvLibraryImportPreviewRequest
): Promise<V2CsvLibraryImportPreview> {
  const response = await fetch(csvImportUrl(workspaceId, cardTypeId, "preview"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readV2JsonResponse<V2CsvLibraryImportPreview>(
    response,
    `CSV library import preview failed with ${response.status}`
  );
}

export async function commitV2CsvLibraryImport(
  workspaceId: string,
  cardTypeId: string,
  input: V2CsvLibraryImportCommitRequest
): Promise<V2CsvLibraryImportResult> {
  const response = await fetch(csvImportUrl(workspaceId, cardTypeId, "commit"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readV2JsonResponse<V2CsvLibraryImportResult>(
    response,
    `CSV library import failed with ${response.status}`
  );
}

export async function updateV2CardLibraryEntry(
  workspaceId: string,
  cardTypeId: string,
  libraryEntryId: string,
  input: V2UpdateCardLibraryEntryRequest
): Promise<V2CardLibraryEntry> {
  const response = await fetch(entryUrl(workspaceId, cardTypeId, libraryEntryId), {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return readV2JsonResponse<V2CardLibraryEntry>(
    response,
    `Card library entry update failed with ${response.status}`
  );
}

export async function deleteV2CardLibraryEntry(
  workspaceId: string,
  cardTypeId: string,
  libraryEntryId: string,
  expectedVersion: number
): Promise<void> {
  const searchParams = new URLSearchParams({
    expectedVersion: String(expectedVersion)
  });
  const response = await fetch(
    `${entryUrl(workspaceId, cardTypeId, libraryEntryId)}?${searchParams}`,
    { method: "DELETE", headers: { Accept: "application/json" } }
  );
  await readV2JsonResponse<{ deleted: true; id: string }>(
    response,
    `Card library entry deletion failed with ${response.status}`
  );
}

export async function setV2CardLibraryEntry(
  cardId: string,
  input: V2SetCardLibraryEntryRequest
): Promise<V2Card> {
  const response = await fetch(
    `/v2/actions/cards/${encodeURIComponent(cardId)}/library-entry`,
    {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }
  );
  return readV2JsonResponse<V2Card>(
    response,
    `Card library selection update failed with ${response.status}`
  );
}
