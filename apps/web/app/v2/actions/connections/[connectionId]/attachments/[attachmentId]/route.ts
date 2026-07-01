import { proxyDelete } from "../../../../helpers";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ connectionId: string; attachmentId: string }> }
) {
  const { connectionId, attachmentId } = await context.params;
  return proxyDelete(
    `/v2/connections/${encodeURIComponent(connectionId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}
