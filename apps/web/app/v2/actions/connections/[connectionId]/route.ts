import { proxyDelete, proxyPatch } from "../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  const body = await request.json();
  return proxyPatch(`/v2/connections/${encodeURIComponent(connectionId)}`, body);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  return proxyDelete(`/v2/connections/${encodeURIComponent(connectionId)}`);
}
