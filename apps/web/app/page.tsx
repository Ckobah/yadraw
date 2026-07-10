import { redirect } from "next/navigation";
import { getCurrentV2User } from "../lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentV2User();
  redirect(user ? "/v2/dashboard" : "/login");
}
