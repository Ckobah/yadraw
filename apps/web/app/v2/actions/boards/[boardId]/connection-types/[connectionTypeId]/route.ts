import { proxyPatch } from "../../../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string; connectionTypeId: string }> }
) {
  const { boardId, connectionTypeId } = await context.params;
  const body = await request.json();
  return proxyPatch(
    `/v2/boards/${encodeURIComponent(boardId)}/connection-types/${encodeURIComponent(connectionTypeId)}`,
    body
  );
}
