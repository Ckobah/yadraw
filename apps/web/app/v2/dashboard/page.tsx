import { LayoutDashboard, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentV2User } from "../../../lib/auth/current-user";
import {
  bootstrapCurrentUser,
  fetchCurrentWorkspaces,
  fetchWorkspaceBoards
} from "../../../features/v2-dashboard/server-api";
import { NewBoardForm } from "../../../features/v2-dashboard/new-board-form";
import { WorkspaceSelector } from "../../../features/v2-dashboard/workspace-selector";

export const dynamic = "force-dynamic";

function DashboardSetupError() {
  return (
    <main className="v2DashboardPage v2DashboardErrorPage">
      <section className="v2DashboardEmptyState" role="alert">
        <h1>Workspace setup could not be completed</h1>
        <p>Your data was not partially created. Retry when the service is available.</p>
        <a href="/v2/dashboard" className="v2DashboardPrimaryLink">Retry</a>
      </section>
    </main>
  );
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ workspaceId?: string; next?: string }>;
}) {
  const user = await getCurrentV2User();
  if (!user) redirect("/login?next=/v2/dashboard");

  const params = await searchParams;
  try {
    await bootstrapCurrentUser(user);
  } catch (error) {
    console.error("Dashboard onboarding failed:", error);
    return <DashboardSetupError />;
  }
  if (params.next?.startsWith("/") && !params.next.startsWith("//") && params.next !== "/v2/dashboard") {
    redirect(params.next);
  }

  try {
    const workspaces = await fetchCurrentWorkspaces(user);
    const requestedWorkspaceId = params.workspaceId;
    const selectedWorkspace =
      workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? workspaces[0];
    const boards = selectedWorkspace
      ? await fetchWorkspaceBoards(user, selectedWorkspace.id)
      : [];

    return (
      <main className="v2DashboardPage">
        <header className="v2DashboardHeader">
          <div className="v2DashboardBrand">
            <LayoutDashboard size={22} />
            <strong>Yadraw</strong>
          </div>
          <div className="v2DashboardAccount">
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="v2DashboardIconButton" title="Sign out" aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>

        <section className="v2DashboardWorkspaceBar" aria-label="Workspace controls">
          <WorkspaceSelector workspaces={workspaces} selectedId={selectedWorkspace?.id ?? null} />
          {selectedWorkspace ? <NewBoardForm workspaceId={selectedWorkspace.id} /> : null}
        </section>

        <section className="v2DashboardContent" aria-labelledby="boards-title">
          <div className="v2DashboardSectionHeading">
            <div>
              <h1 id="boards-title">Boards</h1>
              <p>{selectedWorkspace?.name ?? "Personal workspace"}</p>
            </div>
            <span>{boards.length} total</span>
          </div>

          {boards.length > 0 ? (
            <div className="v2DashboardBoardList" role="list">
              {boards.map((board) => (
                <a key={board.id} href={`/v2/boards/${board.id}`} className="v2DashboardBoardRow" role="listitem">
                  <strong>{board.name}</strong>
                  <span>Updated {new Date(board.updatedAt).toLocaleDateString("en-US")}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="v2DashboardEmptyState">
              <h2>No boards yet</h2>
              <p>Create a board to start arranging cards and connections.</p>
            </div>
          )}
        </section>
      </main>
    );
  } catch (error) {
    console.error("Dashboard loading failed:", error);
    return <DashboardSetupError />;
  }
}
