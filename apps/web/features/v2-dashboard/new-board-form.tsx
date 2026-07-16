"use client";

import type { V2BoardBlueprintKey } from "@yadraw/shared";
import { GitBranch, Network, Plus, Square, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createV2BoardFromChoice,
  getV2BoardStartChoice,
  V2_BOARD_START_CHOICES
} from "./board-blueprints";

type NewBoardFormProps = {
  workspaceId: string;
  initiallyOpen?: boolean;
};

export function NewBoardForm({ workspaceId, initiallyOpen = false }: NewBoardFormProps) {
  const router = useRouter();
  const initialChoice = getV2BoardStartChoice("process_map_v1");
  const [name, setName] = useState(initialChoice.defaultName);
  const [blueprint, setBlueprint] = useState<V2BoardBlueprintKey | null>(initialChoice.key);
  const [open, setOpen] = useState(initiallyOpen);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseBlueprint(nextBlueprint: V2BoardBlueprintKey | null) {
    const previousDefault = getV2BoardStartChoice(blueprint).defaultName;
    const nextChoice = getV2BoardStartChoice(nextBlueprint);
    setBlueprint(nextBlueprint);
    setName((current) => current === previousDefault ? nextChoice.defaultName : current);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || pending) return;
    setPending(true);
    setError(null);
    try {
      const board = await createV2BoardFromChoice({ workspaceId, name: trimmedName, blueprint });
      router.push(`/v2/boards/${board.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Board creation failed. Please retry.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="v2DashboardNewButton" onClick={() => setOpen(true)}>
        <Plus size={17} /> New board
      </button>
    );
  }

  return (
    <form
      className="v2DashboardNewForm"
      onSubmit={handleSubmit}
      aria-busy={pending}
    >
      <div className="v2DashboardNewHeader">
        <div>
          <span>New board</span>
          <strong>Choose a useful starting point</strong>
        </div>
        <button
          type="button"
          className="v2DashboardNewClose"
          aria-label="Close new board form"
          title="Close"
          onClick={() => { setOpen(false); setError(null); }}
          disabled={pending}
        >
          <X size={16} />
        </button>
      </div>

      <fieldset className="v2DashboardBlueprintFieldset">
        <legend>Starting point</legend>
        <div className="v2DashboardBlueprintGrid">
          {V2_BOARD_START_CHOICES.map((choice) => {
            const Icon = getChoiceIcon(choice.key);
            const checked = choice.key === blueprint;
            return (
              <label
                key={choice.key ?? "blank"}
                className={`v2DashboardBlueprintChoice${checked ? " v2DashboardBlueprintChoiceSelected" : ""}`}
              >
                <input
                  type="radio"
                  name="board-start"
                  value={choice.key ?? "blank"}
                  checked={checked}
                  onChange={() => chooseBlueprint(choice.key)}
                  disabled={pending}
                />
                <span className="v2DashboardBlueprintIcon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{choice.title}</strong>
                  <small>{choice.description}</small>
                  <em>{choice.summary}</em>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="v2DashboardNewFooter">
        <label className="v2DashboardBoardName">
          <span>Board name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Board name"
            maxLength={120}
            autoFocus={!initiallyOpen}
            required
            disabled={pending}
          />
        </label>
        <button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Creating board…" : "Create board"}
        </button>
      </div>
      <p className="v2DashboardBlueprintNote">
        Blueprints create editable example cards, fields, and typed relationships in one operation.
      </p>
      {error ? <p className="v2DashboardNewError" role="alert">{error}</p> : null}
    </form>
  );
}

function getChoiceIcon(key: V2BoardBlueprintKey | null) {
  if (key === "process_map_v1") return GitBranch;
  if (key === "typed_knowledge_graph_v1") return Network;
  return Square;
}
