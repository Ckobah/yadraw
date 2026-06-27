import type { V2BoardDetail } from "@yadraw/shared";
import { fetchV2Board } from "../../../../features/v2-board/api";
import { V2BoardPage } from "../../../../features/v2-board/v2-board-page";
import { V2BoardEmptyState } from "../../../../features/v2-board/v2-board-empty-state";
import { V2BoardErrorState } from "../../../../features/v2-board/v2-board-error-state";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function V2BoardRoute({ params }: PageProps) {
  const { boardId } = await params;

  let boardDetail: V2BoardDetail;
  try {
    boardDetail = await fetchV2Board(boardId);
  } catch (error) {
    return (
      <V2BoardErrorState
        boardId={boardId}
        error={error instanceof Error ? error : new Error(String(error))}
      />
    );
  }

  if (boardDetail.cards.length === 0) {
    return <V2BoardEmptyState />;
  }

  return <V2BoardPage boardDetail={boardDetail} />;
}
