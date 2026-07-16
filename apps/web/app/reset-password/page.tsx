import { redirect } from "next/navigation";
import { YadrawLogo } from "../../components/yadraw-logo";
import { getCurrentV2User } from "../../lib/auth/current-user";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  if (!(await getCurrentV2User())) redirect("/forgot-password");
  return <main className="v2AuthPage"><section className="v2AuthPanel" aria-labelledby="new-password-title"><div className="v2AuthBrand"><YadrawLogo /></div><h1 id="new-password-title">Choose a new password</h1><ResetPasswordForm /></section></main>;
}
