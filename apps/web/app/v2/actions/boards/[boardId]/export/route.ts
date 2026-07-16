import { proxyGetJson } from "../../../helpers";

export async function GET(_request: Request, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const response = await proxyGetJson(`/v2/boards/${encodeURIComponent(boardId)}/export`);
  if (!response.ok) return response;
  const payload: unknown = await response.json();
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Content-Disposition", `attachment; filename="yadraw-board-${boardId}.json"`);
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status: response.status,
    headers,
  });
}
