import { proxyPost } from "../../../../../../../../helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; cardTypeId: string }> }
) {
  const { workspaceId, cardTypeId } = await context.params;
  return proxyPost(
    `/v2/workspaces/${encodeURIComponent(workspaceId)}/card-types/${encodeURIComponent(cardTypeId)}/library-entries/imports/csv/preview`,
    await request.json()
  );
}
