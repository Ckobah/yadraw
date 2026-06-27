import Link from "next/link";
import { BoardEditor } from "@/components/board-editor";
import { boardSchema, type Board } from "@yadraw/shared";

export const dynamic = "force-dynamic";

const apiBaseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

type BoardPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

async function loadBoard(boardId: string): Promise<Board> {
  const response = await fetch(`${apiBaseUrl}/boards/${boardId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Board request failed with ${response.status}`);
  }

  return boardSchema.parse(await response.json());
}

function BoardLoadError({ boardId }: { boardId: string }) {
  return (
    <main className="loadStatePage">
      <section className="loadStatePanel" role="alert">
        <div className="brandMark">Y</div>
        <span className="eyebrow">Board unavailable</span>
        <h1>Could not load this board</h1>
        <p>
          Yadraw now loads boards from the API as the source of truth. Check that the API is running and that
          board <code>{boardId}</code> exists.
        </p>
        <div className="loadStateActions">
          <Link href={`/boards/${boardId}`}>Retry</Link>
          <Link href="/">Home</Link>
        </div>
      </section>
    </main>
  );
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;

  try {
    const board = await loadBoard(boardId);
    return <BoardEditor board={board} initialSyncStatus="Synced" />;
  } catch {
    return <BoardLoadError boardId={boardId} />;
  }
}
