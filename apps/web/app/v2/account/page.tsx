import { redirect } from "next/navigation";
import { getCurrentV2User } from "../../../lib/auth/current-user";
import { AccountSettings } from "./account-settings";

export default async function AccountPage() { const user = await getCurrentV2User(); if (!user) redirect("/login?next=/v2/account"); return <main className="v2DashboardPage"><header className="v2DashboardHeader"><a href="/v2/dashboard" className="v2DashboardBrand">Yadraw</a></header><section className="v2AccountPanel"><h1>Account settings</h1><AccountSettings email={user.email} /></section></main>; }
