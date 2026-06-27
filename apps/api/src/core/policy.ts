import type { RequestContext } from "../context.js";
import type { BoardRepository } from "../repository.js";
import { type AccessLevel, hasWorkspaceAccess } from "../authorization.js";
import { forbidden } from "./errors.js";

export type ResourceRef =
  | { type: "board"; id: string }
  | { type: "card"; id: string }
  | { type: "workspace"; id: string };

export async function authorizeWorkspaceAction(
  repository: BoardRepository,
  context: RequestContext,
  resource: ResourceRef,
  accessLevel: AccessLevel
): Promise<void> {
  const role =
    resource.type === "board"
      ? await repository.getBoardRole(context.userId, resource.id)
      : resource.type === "card"
        ? await repository.getCardRole(context.userId, resource.id)
        : await repository.getWorkspaceRole(context.userId, resource.id);

  if (!hasWorkspaceAccess(role, accessLevel)) {
    forbidden();
  }
}
