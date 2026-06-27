import { redirect } from "next/navigation";
import { demoIds } from "@yadraw/shared";

export default function Home() {
  redirect(`/v2/boards/${demoIds.board}`);
}
