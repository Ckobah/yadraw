import { redirect } from "next/navigation";

type BoardPageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;
  redirect(`/v2/boards/${boardId}`);
}
