# Security Review

Date: 2026-07-12

## Scope

- Secret scan of the current tree and all Git history.
- Secret scan of the production browser bundle and recent public Actions logs.
- Review of ignored files, tracked credential-like filenames, Git remote configuration, and GitHub secret-scanning alerts.
- Review of browser/server authentication boundaries and production secret handling.
- Dependency audit and runtime security-header verification.

## Secret audit result

No committed credentials, private keys, access tokens, passwords, or service-role keys were found.

Verified:

- Gitleaks scanned 141 commits and reported zero findings.
- Gitleaks scanned `apps/web/.next/static` and reported zero findings.
- Gitleaks scanned the latest public GitHub Actions logs and reported zero findings.
- GitHub secret scanning reports zero alerts.
- `.env` and `.env.*` are ignored; only explicit `.env.example` templates are tracked.
- No real `.env`, PEM, P12/PFX, SSH private key, service-account file, or credential file exists in Git history.
- The Git remote URL contains no embedded credentials.
- Browser code contains no trusted user-id header or server-only secret.

Values such as `yadraw`, `yadraw-secret`, and `replace-with...` occur only in local examples, local Docker infrastructure, tests, or documentation. Local Docker ports are bound to `127.0.0.1` so these development defaults are not exposed to the LAN.

## Continuous protections

- CI scans full Git history with a digest-pinned Gitleaks image.
- CI rejects server secret names found in the browser production bundle.
- Common private-key and credential filenames are ignored by Git.
- The production deploy sets `.env` permissions to `600`.
- Deployment rejects short secrets, placeholders, known development defaults, and development database credentials without logging secret values.
- `GITHUB_TOKEN` workflow permissions are restricted to `contents: read`.

## Application security baseline

- Supabase sessions are verified server-side.
- Browser mutations use same-origin Next proxy routes and origin checks.
- Fastify requires a timing-safe internal secret and validates workspace membership.
- CORS is allowlisted and API requests are rate-limited.
- SQL queries are parameterized.
- Upload and multipart sizes are limited server-side.
- Files remain in private object storage outside semantic card data.
- Production responses include CSP, clickjacking, MIME-sniffing, referrer, and permissions protections.

## Remaining non-secret risks

### Moderate: PostCSS advisory through Next.js

`npm audit` reports PostCSS below `8.5.10` through the current Next.js dependency tree. The published exploit requires parsing attacker-controlled CSS and embedding the result in an HTML style element. Yadraw does not accept or process user CSS, so the known exploit path is not present, but the dependency should still be upgraded when Next.js resolves it without an unsafe downgrade.

### Defense in depth: CSP inline scripts

The production CSP is enforced but currently permits inline scripts required by the existing Next.js setup. A nonce-based CSP would provide stronger XSS containment and remains a future hardening task.

### Operational check

`SUPABASE_SERVICE_ROLE_KEY` is optional at runtime but required for self-service account deletion. Deployment validates it when configured and emits a value-free warning when absent.

## Incident rule

If a real secret is ever committed, removing it from the current branch is not sufficient. Revoke or rotate it first, remove it from Git history when necessary, and review access logs for misuse.
