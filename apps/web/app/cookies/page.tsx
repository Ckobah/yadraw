import { PublicDocument } from "../../components/public-document";
import { COOKIE_POLICY_VERSION } from "../../lib/legal";

export default function CookiePolicyPage() {
  return <PublicDocument title="Cookie and Similar Technologies Policy">
    <p><strong>Policy version:</strong> {COOKIE_POLICY_VERSION}. This policy covers cookies, local storage, pixels, SDK storage, and similar access to a browser or device.</p>
    <h2>Current technologies</h2>
    <p>Yadraw currently uses strictly necessary first-party technologies for Supabase authentication/session refresh, request security, and remembering privacy choices. The editor also uses local storage to remember board viewport and selected connection-type preferences requested by the user. Exact Supabase cookie names can vary by project configuration and session state. No advertising or third-party analytics SDK was found in the current application build.</p>
    <h2>Categories</h2>
    <ul>
      <li><strong>Strictly necessary:</strong> sign-in, session continuity, security, load/service delivery, consent choice, and user-requested editor state. These cannot be disabled in Yadraw without breaking the requested service.</li>
      <li><strong>Functional:</strong> optional convenience, embedded content, or personalization beyond what is necessary.</li>
      <li><strong>Analytics:</strong> optional audience and product measurement.</li>
      <li><strong>Marketing:</strong> optional advertising, campaign attribution, cross-context measurement, or profiling.</li>
    </ul>
    <p>The optional categories are currently off and no script may treat “Accept all” as permission for a purpose not described here. Before a new vendor or technology is activated, the register must be updated with its provider, purpose, data, first/third-party status, and duration, and the implementation must check the relevant stored opt-in before loading it.</p>
    <h2>Choice and duration</h2>
    <p>The `yadraw_cookie_consent` first-party cookie stores the policy version and optional category choices for 180 days. Rejecting is as easy as accepting. Change or withdraw your choice at any time with “Privacy choices.” Browser controls can also delete or block storage, but blocking necessary session storage may prevent sign-in.</p>
    <h2>Do Not Track and Global Privacy Control</h2>
    <p>Because Yadraw currently does not sell/share information for behavioral advertising, a Global Privacy Control signal does not change current processing. If qualifying sale, sharing, or targeted advertising is introduced, Yadraw must honor applicable opt-out signals and provide the required link before activation. Browser Do Not Track has no universally binding technical standard.</p>
  </PublicDocument>;
}
