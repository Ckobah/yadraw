import { proxyGetJson, proxyPostFormData } from "../../../helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  return proxyGetJson(`/v2/connections/${encodeURIComponent(connectionId)}/attachments`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await context.params;
  const formData = await request.formData();
  return proxyPostFormData(
    `/v2/connections/${encodeURIComponent(connectionId)}/attachments`,
    formData
  );
}
