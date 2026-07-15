import { PublicDocument } from "../../components/public-document";
import { legalOperator } from "../../lib/legal";

export default function PrivacyPage() {
  const operator = legalOperator();
  return <PublicDocument title="Privacy Policy">
    <p>This notice explains how {operator.name} ("Yadraw", "we", "us") handles personal information when you visit yadraw.com, create an account, use a workspace, upload content, or contact support.</p>

    <h2>Controller and contact</h2>
    <p>The data controller is {operator.name}{operator.address ? `, ${operator.address}` : ""}{operator.country ? `, ${operator.country}` : ""}. Taxpayer Identification Number (INN): {operator.inn}. Primary State Registration Number of Individual Entrepreneur (OGRNIP): {operator.ogrnip}. Privacy requests may be sent to <a href={`mailto:${operator.email}`}>{operator.email}</a>.</p>

    <h2>Information we collect</h2>
    <ul>
      <li><strong>Account and profile:</strong> user ID, email address, name, avatar, authentication provider, account status, and legal-acceptance records.</li>
      <li><strong>User content:</strong> workspaces, boards, cards, connections, schemas, settings, comments or other structured content, and files you choose to upload.</li>
      <li><strong>Technical and usage:</strong> IP address, timestamps, request and security identifiers, device/browser information, cookie or local-storage preferences, diagnostic events, and actions needed to operate and protect the service.</li>
      <li><strong>Communications:</strong> support messages, privacy requests, feedback, and related records.</li>
      <li><strong>Future optional features:</strong> if introduced, billing, integrations, collaboration, analytics, marketing, or AI features may process the information described at the point of collection. Materially new purposes will receive notice and, where required, a separate choice before activation.</li>
    </ul>
    <p>Please do not upload government identifiers, payment-card data, health data, biometric data, precise location, information about children, or other sensitive data unless Yadraw expressly supports that use and provides the required safeguards.</p>

    <h2>Purposes and legal bases</h2>
    <p>We process information to create and authenticate accounts; provide, synchronize, export, and delete workspaces; store requested files; support users; secure the service; prevent fraud and abuse; diagnose failures; comply with law; establish or defend legal claims; and improve features using aggregated or appropriately de-identified information. Depending on applicable law, the bases are performance of our contract, steps requested before a contract, legal obligations, legitimate interests in secure and reliable operations, and consent for optional technologies or other processing where consent is required. Withdrawing optional consent does not affect earlier lawful processing.</p>

    <h2>How information is obtained</h2>
    <p>We receive information from you, your browser or device, authorized workspace members, authentication and infrastructure providers, integrations you enable, and public or lawful anti-abuse sources. Workspace administrators may manage access to shared workspace information.</p>

    <h2>Recipients and processors</h2>
    <p>Information may be disclosed only as needed to authentication, hosting, database, object-storage, network, email, security, support, professional-adviser, and integration providers; authorized workspace members; a successor in a corporate transaction; or authorities when legally required. Providers act under contractual and confidentiality restrictions appropriate to their role. We do not sell personal information and do not share it for cross-context behavioral advertising. If that changes, this policy and the privacy controls will be updated before the practice begins.</p>

    <h2>International transfers</h2>
    <p>Yadraw and its providers may process information outside your country. Where required, transfers use an adequacy decision, approved contractual clauses, contractual/security measures, or separate consent. A transfer will not be represented as compliant until its destination, recipient, and mechanism have been assessed. Russian users should note that service availability depends on the operator completing applicable localization and cross-border-transfer requirements.</p>

    <h2>Retention</h2>
    <p>Active account data and user content are kept while needed to provide the service. Account deletion disables application access and starts deletion from active systems. Backups, security logs, legal-acceptance evidence, fraud-prevention records, and records needed for legal obligations or claims may remain for limited, documented periods. Details are in the <a href="/retention">Data Retention Notice</a>. We delete or de-identify information when its purpose and required retention end.</p>

    <h2>Your rights and choices</h2>
    <p>Depending on your location, you may request access, a copy/portability, correction, deletion, restriction, objection, or withdrawal of consent; appeal a refused request; limit certain sensitive-data uses; opt out of sale, targeted advertising, or qualifying profiling; and complain to a data-protection authority. We will not discriminate against you for exercising a statutory right. Use Account settings for export/deletion where available or email the privacy contact. We may verify identity and may preserve information where an exception applies. Authorized agents may submit requests where local law permits.</p>
    <p>Browser Global Privacy Control signals are treated as an opt-out of sale/sharing and targeted advertising where legally required. Yadraw currently performs none of those activities. Optional cookie choices can be changed at any time using “Privacy choices.”</p>

    <h2>Security and automated decisions</h2>
    <p>We use access controls, private storage, encrypted transport, authentication, monitoring, rate limits, validation, backups, and other proportionate safeguards. No system is risk-free. Yadraw does not currently make decisions producing legal or similarly significant effects solely by automated means. AI-assisted features, if introduced, will be identified and subject to additional controls where required.</p>

    <h2>Children</h2>
    <p>Yadraw is a general-audience professional service for adults and is not directed to children. You must be at least 18 years old to create an account. Do not submit personal information about a child. Contact us if you believe a child has provided information.</p>

    <h2>Changes</h2>
    <p>We may update this notice as the service or law changes. The effective date and version will change. Material changes will be presented in the service, and fresh consent will be requested where law requires it. A policy update does not authorize an unrelated new purpose retroactively.</p>
  </PublicDocument>;
}
