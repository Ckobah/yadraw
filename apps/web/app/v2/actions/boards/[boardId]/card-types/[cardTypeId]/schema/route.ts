import { proxyPatch } from "../../../../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string; cardTypeId: string }> }
) {
  const { boardId, cardTypeId } = await context.params;
  const body = await request.json();
  return proxyPatch(
    `/v2/boards/${encodeURIComponent(boardId)}/card-types/${encodeURIComponent(cardTypeId)}/schema`,
    body
  );
}
