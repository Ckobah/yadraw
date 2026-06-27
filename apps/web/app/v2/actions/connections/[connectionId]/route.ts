import { proxyDelete } from "../../helpers";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  return proxyDelete(`/v2/connections/${encodeURIComponent(connectionId)}`);
}
