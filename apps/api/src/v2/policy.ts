import type { V2WorkspaceRole } from "@yadraw/shared";

export type V2AccessLevel = "read" | "write" | "manage";

const readRoles = new Set<V2WorkspaceRole>(["owner", "admin", "editor", "viewer", "service"]);
const writeRoles = new Set<V2WorkspaceRole>(["owner", "admin", "editor", "service"]);
const manageRoles = new Set<V2WorkspaceRole>(["owner", "admin", "service"]);

export function hasV2WorkspaceAccess(role: V2WorkspaceRole | null, accessLevel: V2AccessLevel): boolean {
  if (!role) return false;
  if (accessLevel === "read") return readRoles.has(role);
  return accessLevel === "write" ? writeRoles.has(role) : manageRoles.has(role);
}
