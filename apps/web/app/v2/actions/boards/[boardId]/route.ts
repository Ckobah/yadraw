import { proxyDelete, proxyPatch } from "../../helpers";

export async function PATCH(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return proxyPatch(`/v2/boards/${encodeURIComponent(boardId)}`, await request.json());
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return proxyDelete(`/v2/boards/${encodeURIComponent(boardId)}`);
}
