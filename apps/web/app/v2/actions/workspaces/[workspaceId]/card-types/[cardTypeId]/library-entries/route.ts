import {
  appendForwardedQuery,
  proxyGetJson,
  proxyPost
} from "../../../../../helpers";

const listQueryKeys = ["query", "status", "cursor", "limit", "sort", "direction"] as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string; cardTypeId: string }> }
) {
  const { workspaceId, cardTypeId } = await context.params;
  const path = appendForwardedQuery(
    `/v2/workspaces/${encodeURIComponent(workspaceId)}/card-types/${encodeURIComponent(cardTypeId)}/library-entries`,
    request,
    listQueryKeys
  );
  return proxyGetJson(path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; cardTypeId: string }> }
) {
  const { workspaceId, cardTypeId } = await context.params;
  const csvImport = new URL(request.url).searchParams.get("csvImport");
  const xlsxAction = new URL(request.url).searchParams.get("xlsxAction");
  if (csvImport !== null && csvImport !== "preview" && csvImport !== "commit") {
    return Response.json(
      { error: { code: "invalid_request", message: "Invalid CSV import action" } },
      { status: 400 }
    );
  }
  if (
    xlsxAction !== null &&
    xlsxAction !== "export" &&
    xlsxAction !== "preview" &&
    xlsxAction !== "commit"
  ) {
    return Response.json(
      { error: { code: "invalid_request", message: "Invalid XLSX action" } },
      { status: 400 }
    );
  }
  if (csvImport !== null && xlsxAction !== null) {
    return Response.json(
      { error: { code: "invalid_request", message: "Choose one library import action" } },
      { status: 400 }
    );
  }
  const collectionPath =
    `/v2/workspaces/${encodeURIComponent(workspaceId)}/card-types/${encodeURIComponent(cardTypeId)}/library-entries`;
  const xlsxPath = xlsxAction === "export"
    ? `${collectionPath}/workbook/export`
    : xlsxAction
      ? `${collectionPath}/imports/xlsx/${xlsxAction}`
      : null;
  return proxyPost(
    xlsxPath ?? (csvImport ? `${collectionPath}/imports/csv/${csvImport}` : collectionPath),
    await request.json()
  );
}
