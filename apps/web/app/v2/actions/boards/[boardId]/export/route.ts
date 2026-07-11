import { proxyGetJson } from "../../../helpers";

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const response = await proxyGetJson(`/v2/boards/${encodeURIComponent(boardId)}/export`);
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("Content-Disposition", `attachment; filename="yadraw-board-${boardId}.json"`);
  return new Response(response.body, { status: response.status, headers });
}
