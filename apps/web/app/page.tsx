import { BoardEditor } from "@/components/board-editor";
import { demoBoard } from "@yadraw/shared";

export default function Home() {
  return <BoardEditor board={demoBoard} />;
}
