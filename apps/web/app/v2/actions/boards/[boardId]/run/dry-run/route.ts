import { proxyPost } from "../../../../helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await context.params;
  const body = await request.json().catch(() => ({}));
  return proxyPost(
    `/v2/boards/${encodeURIComponent(boardId)}/run/dry-run`,
    body
  );
}
