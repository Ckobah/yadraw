/**
 * Server-side proxy helper for v2 web mutation actions.
 *
 * These route handlers proxy browser requests to the backend API,
 * adding the x-yadraw-user-id header server-side so V2_USER_ID
 * never reaches the browser.
 */

const apiBaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000";

function serverHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const userId = process.env.V2_USER_ID;
  if (!userId) {
    throw new Error("V2_USER_ID is required for v2 web mutation proxy");
  }
  headers["x-yadraw-user-id"] = userId;
  return headers;
}

export async function proxyPatch(
  path: string,
  body: unknown
): Promise<Response> {
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: serverHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}

export async function proxyPost(
  path: string,
  body: unknown
): Promise<Response> {
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: serverHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}

export async function proxyDelete(path: string): Promise<Response> {
  const url = `${apiBaseUrl}${path}`;
  // Note: no Content-Type header — DELETE requests have no body
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const userId = process.env.V2_USER_ID;
  if (userId) {
    headers["x-yadraw-user-id"] = userId;
  }
  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}
