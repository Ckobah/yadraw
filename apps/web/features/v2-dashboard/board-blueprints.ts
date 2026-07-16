import type { V2BoardBlueprintKey } from "@yadraw/shared";

export type BoardStartChoice = {
  key: V2BoardBlueprintKey | null;
  title: string;
  description: string;
  defaultName: string;
  summary: string;
};

export const V2_BOARD_START_CHOICES: readonly BoardStartChoice[] = [
  {
    key: "process_map_v1",
    title: "Process Map",
    description: "Activities with owners, systems, problems, and status.",
    defaultName: "Process map",
    summary: "5 example activities · Next, Depends on, Uses"
  },
  {
    key: "typed_knowledge_graph_v1",
    title: "Typed Knowledge Graph",
    description: "Sources, claims, questions, and decisions with meaningful links.",
    defaultName: "Knowledge graph",
    summary: "5 example records · Supports, Contradicts, Depends on, Follows"
  },
  {
    key: null,
    title: "Blank board",
    description: "Start with an empty canvas and your workspace card types.",
    defaultName: "Untitled board",
    summary: "No example cards or relationships"
  }
];

export function getV2BoardStartChoice(key: V2BoardBlueprintKey | null): BoardStartChoice {
  return V2_BOARD_START_CHOICES.find((choice) => choice.key === key) ?? V2_BOARD_START_CHOICES[0]!;
}

export async function createV2BoardFromChoice(input: {
  workspaceId: string;
  name: string;
  blueprint: V2BoardBlueprintKey | null;
}): Promise<{ id: string }> {
  const response = await fetch(
    `/v2/actions/workspaces/${encodeURIComponent(input.workspaceId)}/boards`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: input.name,
        ...(input.blueprint ? { blueprint: input.blueprint } : {})
      })
    }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Board creation failed. Please retry.");
  }
  const board = (await response.json()) as { id?: unknown };
  if (typeof board.id !== "string" || !board.id) {
    throw new Error("Board creation returned an invalid response.");
  }
  return { id: board.id };
}
