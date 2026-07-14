import { proxyPatch } from "../../../helpers";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  return proxyPatch(
    `/v2/cards/${encodeURIComponent(cardId)}/library-entry`,
    await request.json()
  );
}
