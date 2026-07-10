import { redirect } from "next/navigation";
import { getCurrentV2User } from "../../lib/auth/current-user";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const user = await getCurrentV2User();
  if (user) redirect("/v2/dashboard");
  const { next, error } = await searchParams;

  return (
    <main className="v2AuthPage">
      <section className="v2AuthPanel" aria-labelledby="login-title">
        <div className="v2AuthBrand">Yadraw</div>
        <h1 id="login-title">Sign in to your workspace</h1>
        <p>Use your email and password to access private boards.</p>
        <LoginForm
          nextPath={next}
          initialMessage={error ? "The authentication callback could not be completed." : null}
        />
      </section>
    </main>
  );
}
