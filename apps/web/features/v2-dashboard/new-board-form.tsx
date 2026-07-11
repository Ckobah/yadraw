"use client";

import { Plus, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewBoardForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/v2/actions/workspaces/${encodeURIComponent(workspaceId)}/boards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: trimmedName })
        }
      );
      if (!response.ok) throw new Error(`Board creation failed with ${response.status}`);
      const board = (await response.json()) as { id: string };
      router.push(`/v2/boards/${board.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Board creation failed.");
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
    <form className="v2DashboardNewForm" onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Board name"
        maxLength={120}
        autoFocus
        required
      />
      <button type="submit" disabled={pending}>{pending ? "Creating" : "Create"}</button>
      <button
        type="button"
        aria-label="Close new board form"
        title="Close"
        onClick={() => { setOpen(false); setError(null); }}
      >
        <X size={16} />
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </form>
  );
}
