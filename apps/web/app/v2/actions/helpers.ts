/**
 * Server-side proxy helper for v2 web mutation actions.
 *
 * These route handlers proxy browser requests to the backend API,
 * adding the verified user id header only on the server-to-API request.
 */
import "server-only";
import { getCurrentV2User } from "../../../lib/auth/current-user";
import { buildInternalApiHeaders } from "../../../lib/api/internal-api";

const apiBaseUrl =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4000";

async function serverHeaders(includeContentType: boolean): Promise<Record<string, string> | null> {
  const user = await getCurrentV2User();
  if (!user) return null;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...buildInternalApiHeaders(user.id),
  };
  if (includeContentType) headers["Content-Type"] = "application/json";
  return headers;
}

function unauthorizedResponse(): Response {
  return Response.json(
    { error: { code: "unauthorized", message: "Authentication required" } },
    { status: 401 }
  );
}

export async function proxyPatch(
  path: string,
  body: unknown
): Promise<Response> {
  const headers = await serverHeaders(true);
  if (!headers) return unauthorizedResponse();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers,
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
  const headers = await serverHeaders(true);
  if (!headers) return unauthorizedResponse();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}

export async function proxyGetJson(path: string): Promise<Response> {
  const headers = await serverHeaders(false);
  if (!headers) return unauthorizedResponse();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}

export async function proxyPostFormData(
  path: string,
  formData: FormData
): Promise<Response> {
  const headers = await serverHeaders(false);
  if (!headers) return unauthorizedResponse();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}

export async function proxyGetBinary(path: string): Promise<Response> {
  const authHeaders = await serverHeaders(false);
  if (!authHeaders) return unauthorizedResponse();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders,
    cache: "no-store",
  });

  const headers = new Headers();
  for (const header of [
    "content-type",
    "content-length",
    "content-disposition",
  ]) {
    const value = response.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function proxyDelete(path: string): Promise<Response> {
  const headers = await serverHeaders(false);
  if (!headers) return unauthorizedResponse();
  const url = `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });
  if (response.status === 204) {
    return new Response(null, { status: 204 });
  }
  const data = await response.json().catch(() => null);
  return Response.json(data ?? { ok: false }, {
    status: response.status,
  });
}
