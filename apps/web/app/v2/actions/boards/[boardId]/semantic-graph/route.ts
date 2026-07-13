import { proxyGetJson } from "../../../helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await context.params;
  return proxyGetJson(`/v2/boards/${encodeURIComponent(boardId)}/semantic-graph`);
}
