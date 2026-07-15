# Yadraw legal and privacy compliance checklist

Status date: 2026-07-15. This is an engineering compliance baseline, not a legal opinion. No contract or disclaimer can eliminate statutory duties, regulatory enforcement, or all liability worldwide.

## Implemented in the product

- Versioned Terms, Privacy Policy, Personal Data Processing Consent, Cookie Policy, and Retention Notice.
- Separate required acceptance of Terms and personal-data consent; age-18 confirmation.
- PostgreSQL audit record containing user, document versions, timestamp, source, and user agent.
- Re-acceptance gate for existing users and API-level workspace denial until current versions are accepted.
- Optional cookie categories default off, equal “Reject optional” and “Accept all” paths, granular choices, 180-day preference, and persistent settings access.
- No analytics or advertising SDK detected. Future optional scripts must read the corresponding consent category before loading.
- Current statements that personal information is not sold/shared for behavioral advertising and that no solely automated significant decisions are made.

## Operator facts configured

The public legal configuration identifies the controller as `Individual Entrepreneur Vitaliy Sergeevich Perevozchikov`, INN `503212943542`, OGRNIP `323508100581261`, at `Apt. 70, 7 Severnaya Street, Odintsovo, Moscow Region, Russia`, with privacy contact `ckobah@gmail.com`. Production may override these values with `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_ADDRESS`, `LEGAL_OPERATOR_COUNTRY`, `LEGAL_OPERATOR_INN`, `LEGAL_OPERATOR_OGRNIP`, and `PRIVACY_EMAIL`.

Still decide and document:

- governing law and competent venue for the Terms;
- privacy/DPO contact and, if applicable, EU/UK representatives;
- actual hosting, Supabase project region, database, email, network, backup, and object-storage providers and countries;
- exact production retention periods for logs, backups, support, deleted objects, legal evidence, and future billing records;
- whether Yadraw is offered to Russian, Chinese, Korean, Japanese, Singaporean, Californian, or other regulated residents, rather than merely being technically reachable there.

## Operational work documents cannot replace

1. Create a data map and record of processing: every field, purpose, lawful basis, source, recipient, country, retention, and deletion job.
2. Sign processor/data-processing agreements and maintain a named subprocessor register. Complete transfer impact assessments and SCC/UK addendum or other transfer mechanism where required.
3. Implement and test access, correction, export, restriction/objection, deletion, consent withdrawal, appeal, authorized-agent, and regulator-complaint procedures with identity verification and response deadlines.
4. Adopt incident response, evidence preservation, processor notification, and jurisdiction-specific breach assessment/notification playbooks (including GDPR’s applicable 72-hour regulator deadline).
5. Perform DPIAs/PIAs before sensitive data, systematic monitoring, large-scale profiling, children, biometrics, precise location, high-risk AI, or materially new integrations.
6. Maintain security governance: access reviews, encryption/key management, backup restore tests, vulnerability handling, vendor review, log minimization, and staff confidentiality/training.
7. Review marketing email/SMS and advertising separately. Cookie consent does not itself authorize direct marketing.

## Jurisdiction launch gates

- **EU/EEA and UK:** identify controller/representatives, lawful bases, Art. 13/14 disclosures, processor contracts, transfer mechanism, DSAR and breach processes. Optional device storage remains blocked until valid consent. Consent cannot be bundled or made a condition for unnecessary processing.
- **Russia:** obtain Russian counsel before targeted launch. Confirm Roskomnadzor operator notification, Russian-citizen database localization, cross-border-transfer notification/assessment, information-system security requirements, and the standalone consent format effective 2025-09-01. Configure the real operator identity/address before collecting data.
- **California and other US states:** determine annually whether statutory thresholds apply; maintain notice at collection, request/appeal channels, GPC handling, contracts, sensitive-data limits, and “Do Not Sell or Share” controls before any qualifying practice. Do not target under-18 users; COPPA obligations arise with under-13-directed use or actual knowledge.
- **China:** do not target mainland China until PIPL roles, local representative, separate-consent cases, localization/security assessment or standard contract/certification, and cross-border disclosures are reviewed. Consider geoblocking until ready.
- **Japan:** document purposes and APPI disclosures; assess foreign-third-party transfer consent or an applicable alternative and continuing safeguards.
- **South Korea:** obtain local review for PIPA notice/consent, overseas transfer, retention/destruction, domestic representative, and breach duties before targeted launch.
- **Singapore:** designate and publish a DPO contact, implement notification/consent/withdrawal/access/correction rules, protection and retention controls, and comparable-protection transfer arrangements.

## Consent-management tooling decision

The custom manager is proportionate while Yadraw has only necessary storage and no ad-tech vendor chain. Reassess before adding analytics, ads, embedded social/video content, or multiple domains/apps. A commercial CMP such as OneTrust or Cookiebot can add automated scanning, geolocation rules, translations, vendor inventories, consent receipts, and tag blocking. If Google Ads/Analytics or programmatic advertising is introduced, evaluate Google Consent Mode and a currently registered/certified IAB Europe TCF CMP. A CMP is an enforcement tool, not proof that the underlying purpose, disclosure, transfer, contract, or retention is lawful.

## Primary references used

- EU GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- EDPB Guidelines 05/2020 on consent: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en
- European Commission cookies policy: https://commission.europa.eu/cookies-policy_en
- California Attorney General CCPA guidance: https://oag.ca.gov/privacy/ccpa
- US FTC COPPA guidance: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Russian Federal Law 152-FZ (official legal information): https://ips.pravo.gov.ru/api/ips/legislation/document?baseid=None&hash=98490812b3409e2a8d78a11ca9010f434ea3d9250a11dbbdb78690cd5551bdd6
- Russian Federal Law 156-FZ standalone-consent amendment: https://publication.pravo.gov.ru/document/0001202506240021
- China PIPL English reference published by the Supreme People’s Procuratorate: https://en.spp.gov.cn/2021-12/29/c_948419.htm
- Japan PPC laws and policies: https://www.ppc.go.jp/en/legal/
- Singapore PDPC obligations: https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act/data-protection-obligations
- South Korea PIPC guidance for foreign operators: https://www.pipc.go.kr/eng/user/ltn/new/noticeDetail.do?bbsId=BBSMSTR_000000000001&nttId=2488
