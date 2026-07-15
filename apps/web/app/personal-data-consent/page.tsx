import { PublicDocument } from "../../components/public-document";
import { legalOperator, PERSONAL_DATA_CONSENT_VERSION } from "../../lib/legal";

export default function PersonalDataConsentPage() {
  const operator = legalOperator();
  return <PublicDocument title="Personal Data Processing Consent">
    <p><strong>Consent version:</strong> {PERSONAL_DATA_CONSENT_VERSION}. This consent is presented separately from the Terms. It is intended to record consent where applicable law requires consent; processing may also rely on contract, legal obligation, or another lawful basis described in the Privacy Policy.</p>

    <h2>Operator</h2>
    <p>I authorize {operator.name}{operator.address ? `, ${operator.address}` : ""}{operator.country ? `, ${operator.country}` : ""}, Taxpayer Identification Number (INN) {operator.inn}, Primary State Registration Number of Individual Entrepreneur (OGRNIP) {operator.ogrnip} (the “Operator”), contact <a href={`mailto:${operator.email}`}>{operator.email}</a>, to process the data and for the purposes below.</p>

    <h2>Data and purposes</h2>
    <p>The consent covers my account identifier, email, name, avatar, authentication attributes, technical identifiers (including IP address, browser/device and security logs), legal-choice records, support communications, and the personal information I choose to include in workspaces and files. The purposes are account registration and authentication; providing and synchronizing the service; storing and delivering requested content; user support; security, fraud prevention and diagnostics; legal compliance and claims; and optional categories I separately enable in Privacy choices.</p>

    <h2>Operations and method</h2>
    <p>The Operator may collect, record, organize, structure, store, adapt, retrieve, consult, use, transmit to authorized processors or workspace members, restrict, back up, erase, and destroy the data, by automated and non-automated means. The Operator may engage the processor categories and make the international transfers described in the Privacy Policy, but must complete any destination-specific notice, safeguard, localization, or separate-consent requirement before a transfer that requires it.</p>

    <h2>Term and withdrawal</h2>
    <p>This consent applies from my affirmative acceptance until the relevant purpose ends or I withdraw it, subject to mandatory retention and processing that remains lawful on another basis. I may withdraw by deleting my account, changing optional Privacy choices, or emailing the Operator. Withdrawal does not affect prior lawful processing and may make account-dependent service unavailable. Retention and deletion are described in the <a href="/retention">Data Retention Notice</a>.</p>

    <h2>My confirmation</h2>
    <p>By selecting the separate consent checkbox and submitting the acceptance form, I confirm that I have read this document and the <a href="/privacy">Privacy Policy</a>, understand the purposes and operations, am acting voluntarily, and am at least 18 years old. This consent does not waive any statutory right or release the Operator from duties imposed by law.</p>
  </PublicDocument>;
}
