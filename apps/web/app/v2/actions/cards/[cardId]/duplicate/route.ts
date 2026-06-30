import { proxyPost } from "../../../helpers";

export async function POST(
  _request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  return proxyPost(`/v2/cards/${encodeURIComponent(cardId)}/duplicate`, {});
}
