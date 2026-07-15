import { redirect } from "next/navigation";
import { getCurrentV2User } from "../../../../lib/auth/current-user";
import { bootstrapCurrentUser, fetchLegalAcceptance } from "../../../../features/v2-dashboard/server-api";
import { LegalAcceptanceForm } from "./legal-acceptance-form";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/v2/legal/accept")
    ? value
    : "/v2/dashboard";
}

export default async function LegalAcceptancePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentV2User();
  if (!user) redirect("/login?next=/v2/legal/accept");
  await bootstrapCurrentUser(user);
  const status = await fetchLegalAcceptance(user);
  const nextPath = safeNextPath((await searchParams).next);
  if (status.current) redirect(nextPath);

  return <main className="v2AuthPage"><section className="v2LegalAcceptancePanel" aria-labelledby="legal-acceptance-title">
    <div className="v2AuthBrand">Yadraw</div>
    <h1 id="legal-acceptance-title">Review and accept the current terms</h1>
    <p>Required service terms and personal-data consent are separate. Optional cookies are not required to use Yadraw.</p>
    <LegalAcceptanceForm nextPath={nextPath} />
    <form action="/auth/signout" method="post"><button className="v2AuthTextButton" type="submit">Sign out instead</button></form>
  </section></main>;
}
