import { proxyGetJson, proxyPost } from "../../../helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params;
  return proxyGetJson(`/v2/workspaces/${encodeURIComponent(workspaceId)}/boards`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params;
  const body = await request.json();
  return proxyPost(`/v2/workspaces/${encodeURIComponent(workspaceId)}/boards`, body);
}
