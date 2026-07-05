import { proxyDelete, proxyPatch } from "../../../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string; bindingId: string }> }
) {
  const { boardId, bindingId } = await context.params;
  const body = await request.json().catch(() => ({}));
  return proxyPatch(
    `/v2/boards/${encodeURIComponent(boardId)}/field-bindings/${encodeURIComponent(bindingId)}`,
    body
  );
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ boardId: string; bindingId: string }> }
) {
  const { boardId, bindingId } = await context.params;
  return proxyDelete(
    `/v2/boards/${encodeURIComponent(boardId)}/field-bindings/${encodeURIComponent(bindingId)}`
  );
}
