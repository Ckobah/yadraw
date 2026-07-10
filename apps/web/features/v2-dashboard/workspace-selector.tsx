"use client";

import type { V2WorkspaceSummary } from "@yadraw/shared";
import { useRouter } from "next/navigation";

export function WorkspaceSelector({
  workspaces,
  selectedId
}: {
  workspaces: V2WorkspaceSummary[];
  selectedId: string | null;
}) {
  const router = useRouter();
  return (
    <label className="v2DashboardWorkspaceSelector">
      Workspace
      <select
        value={selectedId ?? ""}
        disabled={workspaces.length === 0}
        onChange={(event) => {
          router.push(`/v2/dashboard?workspaceId=${encodeURIComponent(event.target.value)}`);
        }}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name} ({workspace.role})
          </option>
        ))}
      </select>
    </label>
  );
}
