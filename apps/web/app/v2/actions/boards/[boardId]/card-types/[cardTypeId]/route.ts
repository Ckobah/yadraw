import { proxyDelete, proxyPatch } from "../../../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string; cardTypeId: string }> }
) {
  const { boardId, cardTypeId } = await context.params;
  const body = await request.json();
  return proxyPatch(
    `/v2/boards/${encodeURIComponent(boardId)}/card-types/${encodeURIComponent(cardTypeId)}`,
    body
  );
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ boardId: string; cardTypeId: string }> }
) {
  const { boardId, cardTypeId } = await context.params;
  return proxyDelete(
    `/v2/boards/${encodeURIComponent(boardId)}/card-types/${encodeURIComponent(cardTypeId)}`
  );
}
