import type { V2BoardDetail } from "@yadraw/shared";
import { fetchV2Board } from "../../../../features/v2-board/server-api";
import { V2BoardPage } from "../../../../features/v2-board/v2-board-page";
import { V2BoardErrorState } from "../../../../features/v2-board/v2-board-error-state";
import { getCurrentV2User } from "../../../../lib/auth/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function V2BoardRoute({ params }: PageProps) {
  const { boardId } = await params;
  const user = await getCurrentV2User();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/v2/boards/${boardId}`)}`);
  }

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

  return <V2BoardPage boardDetail={boardDetail} />;
}
