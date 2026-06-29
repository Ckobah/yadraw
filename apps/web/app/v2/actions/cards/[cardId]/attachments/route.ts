import { proxyGetJson, proxyPostFormData } from "../../../helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  return proxyGetJson(`/v2/cards/${encodeURIComponent(cardId)}/attachments`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await context.params;
  const formData = await request.formData();
  return proxyPostFormData(
    `/v2/cards/${encodeURIComponent(cardId)}/attachments`,
    formData
  );
}
