# Security Review

Date: 2026-06-25

## Scope

- Static scan of `apps` and `packages` for common DOM XSS sinks and unsafe browser APIs.
- Dependency audit with `npm audit`.
- Configuration review for CORS, security headers, environment variables, and current API access control.

## Resolved in this pass

### API CORS is now allowlisted

The API no longer reflects every browser origin. `apps/api/src/index.ts` now reads `CORS_ORIGIN` and defaults to the local web origins:

- `http://127.0.0.1:3000`
- `http://localhost:3000`

This reduces cross-origin exposure before authentication and cookie/session handling are added.

### Web security headers are enabled

`apps/web/next.config.mjs` now sends:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Confirmed checks

- No direct matches were found for high-risk DOM XSS sinks such as `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, or `document.write` in application code.
- The client-side `NEXT_PUBLIC_API_URL` value is treated as public configuration only, not as a secret.
- `.env` remains ignored; `.env.example` contains only local development values.
- SQL access in the current Postgres repository uses parameterized queries.

## Remaining risks

### High: API endpoints are unauthenticated

Current board, card, and search endpoints do not validate user identity or workspace membership. Anyone who can reach the API can read boards and create or update cards.

Recommended next step:

- Add authentication middleware.
- Validate workspace membership and role per request.
- Keep service-level database credentials away from browser-accessible code.
- Wire the documented RLS policy model into runtime access decisions.

### Medium: CSP is not configured yet

Basic headers are enabled, but `Content-Security-Policy` is not. Next.js needs a nonce- or hash-based setup to avoid breaking runtime scripts, so this should be added intentionally rather than as a broad `unsafe-inline` policy.

Recommended next step:

- Add CSP middleware with per-request nonces.
- Start in report-only mode.
- Tighten `connect-src` to the API and local dev endpoints.

### Medium: `npm audit` reports PostCSS through Next.js

`npm audit` reports 2 moderate vulnerabilities:

- `postcss < 8.5.10`
- `next` via `postcss`

The available automatic fix proposes a breaking and unsafe downgrade of Next.js, so it was not applied. Track the upstream Next.js/PostCSS resolution and update Next.js when a compatible patched release is available.

## Verification

- `npm run test` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm audit --json` completed and reported the two moderate dependency findings above.
