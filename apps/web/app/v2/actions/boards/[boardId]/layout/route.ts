import { proxyPatch } from "../../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await context.params;
  return proxyPatch(
    `/v2/boards/${encodeURIComponent(boardId)}/layout`,
    await request.json()
  );
}
