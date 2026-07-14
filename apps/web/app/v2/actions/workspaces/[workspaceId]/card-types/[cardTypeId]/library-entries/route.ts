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
  return proxyPost(
    `/v2/workspaces/${encodeURIComponent(workspaceId)}/card-types/${encodeURIComponent(cardTypeId)}/library-entries`,
    await request.json()
  );
}
