import { proxyPost } from "../../../helpers";

export async function POST(request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return proxyPost(`/v2/boards/${encodeURIComponent(boardId)}/duplicate`, await request.json());
}
