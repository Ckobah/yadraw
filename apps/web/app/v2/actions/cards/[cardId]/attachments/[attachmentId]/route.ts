import { proxyDelete } from "../../../../helpers";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ cardId: string; attachmentId: string }> }
) {
  const { cardId, attachmentId } = await context.params;
  return proxyDelete(
    `/v2/cards/${encodeURIComponent(cardId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}
