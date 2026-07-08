import { proxyGetJson, proxyPost } from "../../../helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await context.params;
  return proxyGetJson(`/v2/boards/${encodeURIComponent(boardId)}/connection-types`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await context.params;
  const body = await request.json();
  return proxyPost(`/v2/boards/${encodeURIComponent(boardId)}/connection-types`, body);
}
