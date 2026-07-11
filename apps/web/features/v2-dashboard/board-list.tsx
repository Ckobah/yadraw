"use client";

import type { V2BoardSummary } from "@yadraw/shared";
import { Archive, ArchiveRestore, Copy, Download, MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

async function mutate(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message ?? "Operation failed");
}

export function BoardList({ boards }: { boards: V2BoardSummary[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const active = boards.filter((board) => !board.archivedAt);
  const archived = boards.filter((board) => board.archivedAt);

  async function run(action: () => Promise<void>) {
    setError(null);
    try { await action(); router.refresh(); } catch (value) {
      setError(value instanceof Error ? value.message : "Operation failed");
    }
  }

  function group(title: string, items: V2BoardSummary[]) {
    if (!items.length) return null;
    return <section className="v2DashboardBoardGroup" aria-labelledby={`boards-${title.toLowerCase()}`}>
      <h2 id={`boards-${title.toLowerCase()}`}>{title}</h2>
      <div className="v2DashboardBoardList" role="list">
        {items.map((board) => <div key={board.id} className="v2DashboardBoardRow" role="listitem">
          <a href={`/v2/boards/${board.id}`} aria-label={`Open ${board.name}`} />
          <div>
            <input
              aria-label={`Rename ${board.name}`}
              defaultValue={board.name}
              maxLength={160}
              onBlur={(event) => {
                const name = event.currentTarget.value.trim();
                if (name && name !== board.name) void run(() => mutate(`/v2/actions/boards/${board.id}`, "PATCH", { name }));
                else event.currentTarget.value = board.name;
              }}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            />
            <span>Updated {new Date(board.updatedAt).toLocaleDateString("en-US")}</span>
          </div>
          <details className="v2DashboardBoardMenu">
            <summary title="Board actions" aria-label={`Actions for ${board.name}`}><MoreVertical size={18} /></summary>
            <div>
              <button type="button" onClick={() => void run(() => mutate(`/v2/actions/boards/${board.id}/duplicate`, "POST", {}))}><Copy size={16} /> Duplicate</button>
              <button type="button" onClick={() => void run(() => mutate(`/v2/actions/boards/${board.id}`, "PATCH", { archived: !board.archivedAt }))}>{board.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />}{board.archivedAt ? "Restore" : "Archive"}</button>
              <a href={`/v2/actions/boards/${board.id}/export`} download><Download size={16} /> Export JSON</a>
              <button className="danger" type="button" onClick={() => {
                if (window.confirm(`Delete “${board.name}”? This cannot be undone.`)) void run(() => mutate(`/v2/actions/boards/${board.id}`, "DELETE"));
              }}><Trash2 size={16} /> Delete</button>
            </div>
          </details>
        </div>)}
      </div>
    </section>;
  }

  return <>{error ? <p className="v2DashboardError" role="alert">{error}</p> : null}{group("Active", active)}{group("Archived", archived)}</>;
}
