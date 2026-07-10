import { proxyGetJson } from "../helpers";

export async function GET() {
  return proxyGetJson("/v2/workspaces");
}
