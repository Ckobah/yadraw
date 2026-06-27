import { redirect } from "next/navigation";
import { demoIds } from "@yadraw/shared";

export default function Home() {
  redirect(`/boards/${demoIds.board}`);
}
