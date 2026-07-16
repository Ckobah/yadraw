import { YadrawLogo } from "../../components/yadraw-logo";
import { PasswordRecoveryForm } from "./password-recovery-form";

export default function ForgotPasswordPage() {
  return <main className="v2AuthPage"><section className="v2AuthPanel" aria-labelledby="recovery-title">
    <div className="v2AuthBrand"><YadrawLogo /></div><h1 id="recovery-title">Reset your password</h1>
    <p>We will send a secure recovery link to your email.</p><PasswordRecoveryForm />
  </section></main>;
}
