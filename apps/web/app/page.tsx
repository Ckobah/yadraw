import { redirect } from "next/navigation";
import { v2DemoIds } from "@yadraw/shared";

export default function Home() {
  redirect(`/v2/boards/${v2DemoIds.board}`);
}
