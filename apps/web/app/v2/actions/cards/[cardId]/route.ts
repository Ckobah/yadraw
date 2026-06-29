import { proxyDelete, proxyPatch } from "../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  const body = await request.json();
  return proxyPatch(`/v2/cards/${encodeURIComponent(cardId)}`, body);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  return proxyDelete(`/v2/cards/${encodeURIComponent(cardId)}`);
}
