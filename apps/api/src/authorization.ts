import type { WorkspaceRole } from "@yadraw/shared";

export type AccessLevel = "read" | "write";

const readRoles = new Set<WorkspaceRole>(["owner", "admin", "editor", "viewer", "service"]);
const writeRoles = new Set<WorkspaceRole>(["owner", "admin", "editor", "service"]);

export function hasWorkspaceAccess(role: WorkspaceRole | null, accessLevel: AccessLevel): boolean {
  if (!role) return false;
  return accessLevel === "read" ? readRoles.has(role) : writeRoles.has(role);
}
