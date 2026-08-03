# Security Report

Audit of `enterprise-hrms` ahead of a public deployment (Vercel + Render +
MongoDB Atlas). Companion to `DEPLOYMENT_AUDIT.md`
(infra/deploy blockers) and `PRODUCTION_DEPLOYMENT_REPORT.md` (full changelog).

## Summary table

| Area | Status | Notes |
|---|---|---|
| Security headers (Helmet) | ✅ Good | `helmet()` applied globally (`app.js`), default CSP/HSTS/frame-options active — verified via live response headers. |
| CORS | ✅ Fixed this pass | Was single-origin string; now a validated allowlist (`env.corsOrigins`), still credentialed — never `origin: '*'` with credentials. |
| Rate limiting | ⚠️ Accepted trade-off | `express-rate-limit`, in-memory store, applied to `/api/auth/login` and `/api/auth/forgot-password` only (20 req/15min). Correct for Render's single-instance tiers; documented in README as needing `rate-limit-redis` before scaling to >1 instance. |
| NoSQL injection | ✅ Good | Every state-changing route validates `req.body` through Zod (`middleware/validate.js`) and **replaces** `req.body` with the parsed, type-checked result — an object-injection payload like `{email: {"$gt": ""}}` fails `z.string().email()` before it ever reaches Mongoose. |
| JWT handling | ✅ Fixed this pass | Short-lived (15m) access token, long-lived (7d) refresh token stored **hashed** in Mongo (rotated on use, revocable) — was already solid. Fixed: dev secret fallback (`'dev_access_secret'`) now throws at boot if unset in production instead of silently accepting it. |
| Password hashing | ✅ Good | `bcrypt`, 10 salt rounds, no plaintext ever logged or returned. |
| Auth middleware | ✅ Good | Every protected route re-checks the user against the DB (`isActive`) on each request — a deactivated account's still-valid JWT is rejected, not just trusted blindly. |
| Error handling | ✅ Good | Centralized handler (`middleware/errorHandler.js`) maps Mongoose/JWT errors to safe messages; stack traces only ever included when `NODE_ENV=development`. |
| Secrets in repo | ✅ Good | `.gitignore` excludes `.env`/`.env.local`; only `.env.example` (placeholder values) is committed. |
| Cookies | ✅ Good (pre-existing) | `httpOnly`, `secure` and `sameSite` both conditional on `NODE_ENV==='production'` (`utils/cookies.js`) — already correctly set up for cross-site Vercel↔Render auth (`secure:true` + `sameSite:'none'` in prod). |
| XSS | ✅ Good | No `dangerouslySetInnerHTML` anywhere in `client/src`; React's default escaping covers all rendered user content. |
| Proxy trust / IP spoofing | ✅ Fixed this pass | No `trust proxy` setting previously — `express-rate-limit@7` would have **thrown** on Render's `X-Forwarded-For` header, and `req.ip` (used for audit logs and `RefreshToken.createdByIp`) would have resolved to the proxy, not the client. Now `trustProxy: 1` in production only. |
| File upload validation | ✅ Good | `middleware/upload.js` restricts to JPEG/PNG/WEBP, 2MB cap, memory storage (never touches disk) before streaming to Cloudinary. |
| Dependency advisories | ⚠️ Open, tracked | `bcrypt`'s `node-pre-gyp`→`tar` chain (critical, fix needs `bcrypt@6`), `exceljs`→`uuid` (moderate), `react-router` RSC advisory (high, not exploitable — app doesn't use RSC mode). Already documented in README's roadmap; not force-upgraded to avoid breaking changes without a dedicated test pass. |

## Fixed in this pass

1. JWT secrets: fail-fast in production if unset, instead of a usable
   hardcoded fallback (`server/src/config/env.js`).
2. CORS: single hardcoded origin → validated multi-origin allowlist
   (`CORS_ORIGINS`), still `credentials: true` with an explicit allowlist,
   never a wildcard.
3. `trust proxy`: added for production, closing both the rate-limiter crash
   and the IP-spoofing/incorrect-audit-log risk behind Render's proxy.

## Explicitly not changed (already correct, or accepted trade-off)

- Refresh-token cookie flags — already environment-aware and correct.
- In-memory rate limiter — correct for the target single-instance
  deployment; moving it to Redis (already in the stack) is a documented
  follow-up if/when this scales past one instance, not a blocker now.
- Dependency advisories — tracked, not silently ignored, deliberately not
  force-upgraded pre-deploy without a regression pass.

## Recommendations (not implemented — out of scope for this pass)

- Add `express-mongo-sanitize`/`hpp` as defense-in-depth even though Zod
  validation already blocks the practical injection vectors on every
  validated route — cheap insurance for any future route that skips
  `validate()`.
- Centralized error tracking (Sentry or similar) — currently only
  `morgan('combined')` access logs to stdout, already on the README roadmap.
- Automated MongoDB Atlas backups — infra-level, needs to be configured in
  Atlas directly, not in application code.
