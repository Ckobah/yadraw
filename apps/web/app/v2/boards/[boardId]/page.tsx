import type { V2BoardDetail, V2CalculationEvaluation } from "@yadraw/shared";
import {
  fetchV2Board,
  fetchV2CalculationEvaluation
} from "../../../../features/v2-board/server-api";
import { V2BoardPage } from "../../../../features/v2-board/v2-board-page";
import { V2BoardErrorState } from "../../../../features/v2-board/v2-board-error-state";
import { getCurrentV2User } from "../../../../lib/auth/current-user";
import { bootstrapCurrentUser, fetchLegalAcceptance } from "../../../../features/v2-dashboard/server-api";
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
  await bootstrapCurrentUser(user);
  const legalAcceptance = await fetchLegalAcceptance(user);
  if (!legalAcceptance.current) {
    redirect(`/v2/legal/accept?next=${encodeURIComponent(`/v2/boards/${boardId}`)}`);
  }

  const [boardResult, calculationResult] = await Promise.allSettled([
    fetchV2Board(boardId),
    fetchV2CalculationEvaluation(boardId)
  ]);
  if (boardResult.status === "rejected") {
    return (
      <V2BoardErrorState
        boardId={boardId}
        error={
          boardResult.reason instanceof Error
            ? boardResult.reason
            : new Error(String(boardResult.reason))
        }
      />
    );
  }
  const boardDetail: V2BoardDetail = boardResult.value;
  const calculationEvaluation: V2CalculationEvaluation | null =
    calculationResult.status === "fulfilled" ? calculationResult.value : null;

  return (
    <V2BoardPage
      boardDetail={boardDetail}
      initialCalculationEvaluation={calculationEvaluation}
    />
  );
}
