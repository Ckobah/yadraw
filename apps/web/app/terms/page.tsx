import { PublicDocument } from "../../components/public-document";
import { legalOperator } from "../../lib/legal";

export default function TermsPage() {
  const operator = legalOperator();
  return <PublicDocument title="Terms of Service">
    <p>These Terms form a binding agreement between you and {operator.name}, INN {operator.inn}, OGRNIP {operator.ogrnip}, for use of Yadraw. If you use Yadraw for an organization, you represent that you have authority to bind it. You must separately review the <a href="/privacy">Privacy Policy</a> and provide the applicable <a href="/personal-data-consent">Personal Data Processing Consent</a>.</p>

    <h2>Eligibility and accounts</h2>
    <p>You must be at least 18 and legally able to enter this agreement. Provide accurate information, protect account credentials, and notify support of suspected compromise. Accounts may not be transferred or shared in a way that defeats access controls.</p>

    <h2>The service and beta status</h2>
    <p>Yadraw is beta software. Features, limits, APIs, formats, and availability may change. We may maintain, modify, suspend, or discontinue a feature, with reasonable notice when practicable. We do not promise uninterrupted operation, permanent storage, or suitability for a particular regulated or mission-critical use. Keep independent backups of important content.</p>

    <h2>Your content</h2>
    <p>You retain ownership of content you submit. You grant {operator.name} and its processors a worldwide, non-exclusive, limited license to host, copy, transmit, display, transform, back up, and otherwise process that content only to operate, secure, support, and improve the service as described in the Privacy Policy. You are responsible for having all rights and lawful bases needed for content, collaborators, and personal information you submit.</p>

    <h2>Acceptable use</h2>
    <p>You must not violate law or third-party rights; upload malware or unlawful, infringing, deceptive, abusive, or exploitative material; probe or bypass security or authorization; interfere with service operation; scrape or access accounts without permission; expose secrets; use the service for high-risk decisions without qualified human review; or place regulated/sensitive data into Yadraw unless a written agreement and supported feature expressly allow it. You must comply with sanctions, export-control, privacy, employment, consumer, and intellectual-property laws applicable to your use.</p>

    <h2>Integrations, files, and future AI features</h2>
    <p>Third-party integrations are governed by their own terms and privacy practices. You authorize only the data exchange needed for an integration you enable. Uploaded files may be restricted by size and type. AI or automation features may produce incomplete or incorrect output; you must independently review output before relying on it, and no output is legal, medical, financial, safety, or other professional advice.</p>

    <h2>Fees</h2>
    <p>The current beta may include free functionality. If paid plans are introduced, prices, taxes, renewal, cancellation, and refund rules will be disclosed before purchase; no paid subscription starts merely because you accepted these Terms.</p>

    <h2>Suspension and termination</h2>
    <p>You may stop using Yadraw and delete your account. We may restrict or terminate access for material breach, legal obligation, security risk, abuse, nonpayment of a future paid plan, or conduct that threatens users or the service. Where reasonable, we will provide notice and an opportunity to cure. Sections that by nature should survive termination—including ownership, disclaimers, liability limits, indemnity, and dispute terms—survive.</p>

    <h2>Disclaimers</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, YADRAW IS PROVIDED “AS IS” AND “AS AVAILABLE.” WE DISCLAIM IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND WARRANTIES ARISING FROM COURSE OF DEALING. We do not warrant that content will be preserved, output will be accurate, or the service will be secure or error-free. Nothing here excludes a warranty or consumer right that cannot lawfully be excluded.</p>

    <h2>Limitation of liability</h2>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL LOSS, OR FOR LOST PROFITS, REVENUE, GOODWILL, OR DATA. {operator.name.toUpperCase()}’S AGGREGATE LIABILITY ARISING FROM THE SERVICE WILL NOT EXCEED THE GREATER OF US$100 OR THE AMOUNT YOU PAID FOR YADRAW IN THE 12 MONTHS BEFORE THE EVENT. These limits do not apply where prohibited, including liability that cannot be limited for fraud, willful misconduct, death/personal injury, or mandatory data-protection or consumer rights.</p>

    <h2>Indemnity</h2>
    <p>To the extent permitted by law, business users will defend and indemnify {operator.name} against third-party claims arising from their unlawful content, infringement, or material breach of these Terms. This does not apply to consumers where prohibited or to claims caused by {operator.name}.</p>

    <h2>Law and disputes</h2>
    <p>The law of the operator’s principal place of business governs, excluding conflict-of-law rules, and disputes may be brought in competent courts there. Mandatory consumer, privacy, employment, and jurisdictional protections—including a consumer’s right to use courts or regulators in their home jurisdiction—remain unaffected. Before filing, contact <a href={`mailto:${operator.email}`}>{operator.email}</a> so the parties can attempt informal resolution.</p>

    <h2>General</h2>
    <p>These Terms, the documents they incorporate, and any written plan terms are the agreement about Yadraw. If a provision is unenforceable, it is limited only as necessary and the rest remains effective. Failure to enforce is not a waiver. You may not assign this agreement without consent; we may assign it in a merger, reorganization, or sale while preserving applicable privacy rights. Material changes will be notified and may require renewed acceptance; changes do not apply retroactively where prohibited.</p>
  </PublicDocument>;
}
