"use client";

import type { V2BoardBlueprintKey } from "@yadraw/shared";
import { GitBranch, Network, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createV2BoardFromChoice,
  getV2BoardStartChoice
} from "../v2-dashboard/board-blueprints";

type V2BoardEmptyStateProps = {
  workspaceId: string;
  onStartBlank: () => void;
};

export function V2BoardEmptyState({ workspaceId, onStartBlank }: V2BoardEmptyStateProps) {
  const router = useRouter();
  const [pendingBlueprint, setPendingBlueprint] = useState<V2BoardBlueprintKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createFromBlueprint(blueprint: V2BoardBlueprintKey) {
    if (pendingBlueprint) return;
    const choice = getV2BoardStartChoice(blueprint);
    setPendingBlueprint(blueprint);
    setError(null);
    try {
      const board = await createV2BoardFromChoice({
        workspaceId,
        name: choice.defaultName,
        blueprint
      });
      router.push(`/v2/boards/${board.id}`);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Board creation failed. Please retry."
      );
      setPendingBlueprint(null);
    }
  }

  return (
    <aside className="v2BoardFirstRun" aria-label="Empty board">
      <section>
        <span className="v2BoardFirstRunEyebrow">Empty board</span>
        <h1>Start with a working model</h1>
        <p>Use an editable example or place the first card yourself.</p>
        <div className="v2BoardFirstRunChoices">
          <button
            type="button"
            onClick={() => void createFromBlueprint("process_map_v1")}
            disabled={pendingBlueprint !== null}
          >
            <GitBranch size={17} />
            <span>
              <strong>Start with Process Map</strong>
              <small>Activities, owners, systems, and typed flow</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => void createFromBlueprint("typed_knowledge_graph_v1")}
            disabled={pendingBlueprint !== null}
          >
            <Network size={17} />
            <span>
              <strong>Start with Typed Knowledge Graph</strong>
              <small>Sources, claims, questions, and decisions</small>
            </span>
          </button>
          <button
            type="button"
            className="v2BoardFirstRunBlank"
            onClick={onStartBlank}
            disabled={pendingBlueprint !== null}
          >
            <Plus size={17} />
            <span>
              <strong>Start blank</strong>
              <small>Choose a card type, then place it on the canvas</small>
            </span>
          </button>
        </div>
        <div className="v2BoardFirstRunStatus" aria-live="polite">
          {pendingBlueprint ? <span>Creating your editable example…</span> : null}
          {error ? <span role="alert">{error}</span> : null}
        </div>
        <small className="v2BoardFirstRunNote">
          A blueprint opens as a new board. This blank board stays available.
        </small>
      </section>
    </aside>
  );
}
