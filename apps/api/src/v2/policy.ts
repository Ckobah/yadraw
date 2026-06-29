import type { V2WorkspaceRole } from "@yadraw/shared";

export type V2AccessLevel = "read" | "write";

const readRoles = new Set<V2WorkspaceRole>(["owner", "admin", "editor", "viewer", "service"]);
const writeRoles = new Set<V2WorkspaceRole>(["owner", "admin", "editor", "service"]);

export function hasV2WorkspaceAccess(role: V2WorkspaceRole | null, accessLevel: V2AccessLevel): boolean {
  if (!role) return false;
  return accessLevel === "read" ? readRoles.has(role) : writeRoles.has(role);
}
