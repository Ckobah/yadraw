import { proxyGetBinary } from "../../../helpers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  return proxyGetBinary(`/v2/files/${encodeURIComponent(fileId)}/download`);
}
