# Security review

Review of this repository following the [Consensys repo-security-review](https://github.com/Consensys/repo-security-review)
method: secret scanning, tech-stack and architecture analysis, dependency CVE
scanning, code-level OWASP Top 10 / API Top 10 analysis, independent validation
of each finding, then fixes verified against a production build.

**Date:** 16 November 2026 · **Scope:** whole repository (`main`) · **Deployment target assumed:** public internet.

## Summary

No critical or high findings. Nine issues were confirmed (three medium, five low,
one moderate dev-only dependency) and all nine are fixed and re-tested. Two scanner
hits were validated as false positives. The remaining items are documented
design trade-offs and deployment requirements, listed below.

| Severity | Found | Fixed |
|---|---|---|
| Critical | 0 | – |
| High | 0 | – |
| Medium | 3 | 3 |
| Low | 5 | 5 |
| Moderate (dev-only dependency) | 1 | 1 |

## Tooling results

| Tool | Scope | Result |
|---|---|---|
| gitleaks | full git history | no leaks |
| gitleaks | working tree | hits only in git-ignored `.env.local` (local admin password) and `.next/` build output (per-build Next.js keys); neither is committed |
| osv-scanner | `package-lock.json`, 405 packages | no issues |
| npm audit | all dependencies | 8 moderate before fix (dev-only), **0 after** |
| semgrep | 213 rules (`p/default`) plus OWASP Top 10, TypeScript, Next.js, React, nodejsscan, secrets packs; 90 files | 2 findings, both validated as false positives (below) |

## Confirmed findings (all fixed)

| # | Sev. | Finding | Fix |
|---|---|---|---|
| 1 | Medium | **Rate limits keyed on client-supplied IP.** Booking, inquiry and login limits used the leftmost `X-Forwarded-For` value, which any client can set, so rotating it bypassed per-IP limits. | `lib/net.ts` reads the proxy-appended address (`x-real-ip` or the `TRUSTED_PROXY_HOPS`-th entry from the right). Login also caps attempts **per account** (8 per 15 min) and public forms have a **global hourly cap**, so limits hold even when no IP can be trusted. |
| 2 | Medium | **Temporary password not enforced.** Users created with `mustChangePassword` were redirected once after login, but every other admin page and action still accepted the temporary password. | `requireAdmin()` now sends such accounts to `/admin/account` everywhere; only the account page, password change and sign-out are allowed. |
| 3 | Medium | **Missing security headers.** No CSP or HSTS, and `X-Powered-By` disclosed the framework. | CSP, HSTS (production), `X-Frame-Options: DENY`, `COOP`, `Permissions-Policy` and `nosniff` are applied in `next.config.ts` to every route including static files; uploads get a sandboxing CSP; admin responses are `no-store`; `poweredByHeader: false`. |
| 4 | Low | **Login timing reveals which emails exist.** Unknown emails skipped the password hash. | A dummy scrypt verification runs for unknown accounts. |
| 5 | Low | **Unvalidated bound action arguments.** `setStatus`, `setInquiryStatus`, `setUserActive` and `deleteEntity` trusted bound arguments, which clients can tamper with; `deleteEntity` passed the raw id into a query (operator injection with an object id). | Ids are parsed to ObjectIds before any query; statuses and booleans are validated; entity keys use `Object.hasOwn`. |
| 6 | Low | **Image paths accepted `..`** and non-image extensions. | Path must be under `/media/` or `/uploads/`, contain no `..`, and end in an image extension. |
| 7 | Low | **Rate-limit log never expired.** | TTL index (created by the seed and on first use). |
| 8 | Low | **Session cookie scoping and login auditing.** Cookie lacked the `__Host-` prefix; successful and failed logins were not in the audit log. | `__Host-pt_admin` in production (Secure, host-only, `path=/`); logins audited with IP. Password inputs are length-bounded and scrypt parameters bounded. |
| 9 | Moderate (dev) | `minimatch` ReDoS (GHSA-g3hv-75wg-m249) via `typescript-eslint`. Lint toolchain only, not in the runtime bundle. | npm `overrides` pins `minimatch@^11.0.1`. npm's suggested fix (downgrading `eslint-config-next` to v15) was rejected as incompatible with Next 16. |

## Rejected (false positives)

- **semgrep `detect-non-literal-regexp` at `app/admin/(panel)/bookings/page.tsx`:** the admin search term is regex-escaped before `new RegExp`, so it is a literal match. Hardened anyway: length capped at 100.
- **semgrep `detect-non-literal-regexp` at `lib/actions/admin.ts`:** the pattern comes from static field definitions in code, never from input.

## Verified secure (no change needed)

- **Injection:** every database query takes zod-validated strings or parsed ObjectIds; no string-built queries; admin regex search is escaped.
- **XSS:** React escaping throughout; the only `dangerouslySetInnerHTML` is JSON-LD with `<` escaped; admin rich text renders through a component that never injects HTML; `mailto:`/`tel:` values are validated.
- **Access control:** every admin page and server action checks the session and role server-side (the proxy redirect is optimistic only). Content managers cannot change prices, publication, departures, bookings, currency or users, and admin-only fields are ignored server-side for them.
- **Data exposure:** the public departure board carries counts only (no names, contact details, nationality or internal notes); the booking confirmation page reads only non-personal fields.
- **CSRF:** Next.js server actions enforce same-origin; session cookie is `SameSite=Lax`.
- **Sessions:** 256-bit random tokens stored as SHA-256 hashes with TTL expiry; rotated on login and password change; deactivating a user revokes their sessions.
- **Passwords:** scrypt (N=16384, r=8, p=1) with constant-time comparison; 12-character minimum.
- **Uploads:** admin-only, 8 MB limit, magic-byte type check (JPEG/PNG/WebP, no SVG), random server-side filenames.
- **SSRF:** the only outbound request (weather) is built from stored numeric coordinates.
- **Vendored engine** (`vendor/scrollcraft`): no `innerHTML`/`eval`-class sinks; its only fetch loads video sources from first-party markup.

## Re-verification (production build)

- Security headers present on pages, static assets and admin; `X-Powered-By` absent.
- 19 routes at 1440/390/360 px and 11 routes at five further sizes: no console errors under the new CSP, no layout regressions; scroll engine works.
- Login throttle held while every attempt spoofed a different `X-Forwarded-For` / `X-Real-IP` (blocked on attempt 9).
- Temporary-password account: lands on the account page; `/admin`, `/admin/treks`, `/admin/bookings`, `/admin/users` all redirect there and the raw server response contains no protected HTML or data.
- Session cookie: `__Host-pt_admin`, HttpOnly, Secure, SameSite=Lax, path `/`.
- Failed and successful logins appear in the audit log.

## Accepted risks and deployment requirements

- **CSP allows inline scripts.** Next.js needs `'unsafe-inline'` for its bootstrap unless a per-request nonce is used, which would disable prerendering. Every other directive is strict, and no user content is rendered as HTML.
- **Run behind a reverse proxy** that overwrites `X-Forwarded-For` / `X-Real-IP`, and set `TRUSTED_PROXY_HOPS`. The per-account and global caps still apply without one.
- **Account lockout can be triggered by others:** eight wrong passwords lock that email for 15 minutes. This is the deliberate trade-off against brute force.
- **Departure capacity race:** two simultaneous booking requests can exceed capacity by a few seats. Bookings are requests reviewed by an admin before confirmation.
- **Booking references** (`PT-` plus 8 hex characters) expose only non-personal summary data.
- **Production:** MongoDB with authentication and TLS in `MONGODB_URI`; HTTPS; object storage for uploads; a fresh `SEED_ADMIN_PASSWORD`; backups. `.env.local` must never be committed (it is git-ignored).
