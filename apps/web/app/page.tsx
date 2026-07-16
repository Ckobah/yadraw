import type { Metadata } from "next";
import { YadrawLogo } from "../components/yadraw-logo";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Yadraw — Structured visual workspace",
  description:
    "Turn process maps, system diagrams, and connected knowledge into structured models with typed cards and meaningful relationships."
};

const primaryHref = "/login?next=/v2/dashboard";
const primaryLabel = "Start building";

export default function Home() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>

      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Yadraw home">
          <YadrawLogo className={styles.brandLogo} />
        </a>

        <nav className={styles.navigation} aria-label="Main navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#use-cases">Use cases</a>
          <a href="#how-it-works">How it works</a>
          <a href="/support">Support</a>
        </nav>

        <a className={styles.headerAction} href={primaryHref}>{primaryLabel}</a>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span aria-hidden="true" />
              Private beta
            </div>
            <h1 id="hero-title">Turn diagrams into models you can trust.</h1>
            <p className={styles.heroLead}>
              Yadraw is a visual workspace where every card has structured fields and every
              connection has meaning. Map processes, systems, dependencies, and knowledge without
              losing the data behind the picture.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href={primaryHref}>{primaryLabel}</a>
              <a className={styles.secondaryAction} href="#how-it-works">See how it works</a>
            </div>
            <ul className={styles.heroFacts} aria-label="Product highlights">
              <li>Automatic saving</li>
              <li>Private workspaces</li>
              <li>Portable JSON</li>
            </ul>
          </div>

          <div
            className={styles.canvasPreview}
            role="img"
            aria-label="A structured process model connecting an activity, a system, and a decision"
          >
            <div className={styles.previewGrid} aria-hidden="true" />
            <div className={`${styles.previewLine} ${styles.previewLineOne}`} aria-hidden="true">
              <span>uses</span>
            </div>
            <div className={`${styles.previewLine} ${styles.previewLineTwo}`} aria-hidden="true">
              <span>leads to</span>
            </div>

            <article className={`${styles.previewCard} ${styles.previewCardPrimary}`} aria-hidden="true">
              <div className={styles.previewCardType}><span /> Activity</div>
              <strong>Validate order</strong>
              <dl>
                <div><dt>Owner</dt><dd>Operations</dd></div>
                <div><dt>Status</dt><dd>In review</dd></div>
              </dl>
              <i className={`${styles.previewPort} ${styles.previewPortRight}`} />
              <i className={`${styles.previewPort} ${styles.previewPortBottom}`} />
            </article>

            <article className={`${styles.previewCard} ${styles.previewCardSystem}`} aria-hidden="true">
              <div className={styles.previewCardType}><span /> System</div>
              <strong>Billing API</strong>
              <p>Structured service record</p>
              <i className={`${styles.previewPort} ${styles.previewPortLeft}`} />
            </article>

            <article className={`${styles.previewCard} ${styles.previewCardDecision}`} aria-hidden="true">
              <div className={styles.previewCardType}><span /> Decision</div>
              <strong>Ready to ship?</strong>
              <p>Explicit relationship context</p>
              <i className={`${styles.previewPort} ${styles.previewPortTop}`} />
            </article>

            <div className={styles.previewNote} aria-hidden="true">
              <span>Model status</span>
              <strong>3 typed records · 2 relationships</strong>
            </div>
          </div>
        </section>

        <section className={styles.capabilities} id="capabilities" aria-labelledby="capabilities-title">
          <div className={styles.sectionHeading}>
            <span>Structured by design</span>
            <h2 id="capabilities-title">The clarity of a model. The freedom of a canvas.</h2>
            <p>
              Keep the visual overview while preserving the fields, interfaces, and relationships
              that make the diagram useful later.
            </p>
          </div>

          <div className={styles.capabilityGrid}>
            <article>
              <span className={styles.capabilityNumber}>01</span>
              <h3>Cards are records</h3>
              <p>Create reusable card types with consistent fields, choices, dates, and JSON data.</p>
            </article>
            <article>
              <span className={styles.capabilityNumber}>02</span>
              <h3>Connections carry meaning</h3>
              <p>Use stable ports and typed relationships instead of lines that lose their context.</p>
            </article>
            <article>
              <span className={styles.capabilityNumber}>03</span>
              <h3>Presentation stays separate</h3>
              <p>Change layout and styling without mixing visual choices into your business data.</p>
            </article>
          </div>
        </section>

        <section className={styles.useCases} id="use-cases" aria-labelledby="use-cases-title">
          <div className={styles.sectionHeadingCompact}>
            <span>One structured canvas</span>
            <h2 id="use-cases-title">Start with the work you already understand.</h2>
          </div>

          <div className={styles.useCaseList}>
            <article>
              <div className={styles.useCaseIcon} aria-hidden="true">P</div>
              <div>
                <h3>Process mapping</h3>
                <p>Keep owners, systems, risks, and decisions consistent across every process step.</p>
              </div>
              <span>Operations</span>
            </article>
            <article>
              <div className={styles.useCaseIcon} aria-hidden="true">S</div>
              <div>
                <h3>System design</h3>
                <p>Connect services, databases, queues, and APIs through explicit semantic ports.</p>
              </div>
              <span>Architecture</span>
            </article>
            <article>
              <div className={styles.useCaseIcon} aria-hidden="true">K</div>
              <div>
                <h3>Connected knowledge</h3>
                <p>Model sources, claims, questions, and dependencies without flattening them into notes.</p>
              </div>
              <span>Research</span>
            </article>
          </div>
        </section>

        <section className={styles.howItWorks} id="how-it-works" aria-labelledby="how-title">
          <div className={styles.howIntro}>
            <span>How it works</span>
            <h2 id="how-title">Build the picture and the model together.</h2>
            <p>No separate database setup. Define the structure you need, then work directly on the canvas.</p>
          </div>

          <ol className={styles.steps}>
            <li>
              <span>1</span>
              <div><h3>Define your records</h3><p>Create card types for the real objects in your work.</p></div>
            </li>
            <li>
              <span>2</span>
              <div><h3>Connect with intent</h3><p>Attach relationships to stable inputs and outputs.</p></div>
            </li>
            <li>
              <span>3</span>
              <div><h3>Refine without losing data</h3><p>Move, route, inspect, attach files, and export the model.</p></div>
            </li>
          </ol>
        </section>

        <section className={styles.trust} aria-labelledby="trust-title">
          <div>
            <span>Built for responsible work</span>
            <h2 id="trust-title">Private by default. Clear about what is beta.</h2>
          </div>
          <div className={styles.trustDetails}>
            <p>
              Boards are protected by authenticated workspace access. Files stay private and are
              delivered through the application rather than exposed as public storage links.
            </p>
            <p>
              Yadraw is currently best for individual builders and focused review workflows.
              Real-time co-editing, public sharing, and semantic search are not available yet.
            </p>
            <a href="/privacy">Read the Privacy Policy</a>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="cta-title">
          <span>Bring structure to the canvas</span>
          <h2 id="cta-title">Build a model that stays useful after the meeting.</h2>
          <p>Start with one process, system, or knowledge map and shape Yadraw with real feedback.</p>
          <a className={styles.primaryActionInverted} href={primaryHref}>{primaryLabel}</a>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <a className={styles.brand} href="/" aria-label="Yadraw home">
            <YadrawLogo className={styles.brandLogo} />
          </a>
          <p>Structured cards. Meaningful relationships. Clear models.</p>
        </div>
        <nav aria-label="Legal and support">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/cookies">Cookies</a>
          <a href="/support">Support</a>
        </nav>
      </footer>
    </div>
  );
}
