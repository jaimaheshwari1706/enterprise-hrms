# Deployment Audit

Point-in-time audit of `enterprise-hrms` for deploying frontend → Vercel,
backend → Render, DB → MongoDB Atlas. Written before any production-readiness
changes were made (see `PRODUCTION_DEPLOYMENT_REPORT.md` for what changed).

## Current Architecture

- **Client**: React 19 + Vite 8, React Router 7, Redux Toolkit, Tailwind 4.
  Talks to the API through a single shared `axios` instance
  (`client/src/api/axiosInstance.js`) — no module bypasses it, no hardcoded
  URLs besides the intentional dev fallback.
- **Server**: Express 4 + Mongoose 8. Auth is access-token-in-memory +
  httpOnly refresh-token cookie, refresh tokens hashed and stored in Mongo
  (rotated on use, revocable). Feature set: employees, departments,
  designations, leave, attendance, payroll, org settings, audit log,
  notifications, dashboard.
- **Integrations already wired (not stubs)**: Redis (cache-aside for
  dashboard/org-settings reads, `server/src/config/redis.js`, degrades to a
  no-op client when `REDIS_ENABLED=false`), Cloudinary (avatar/org-logo/
  employee-photo uploads via `multer` memory storage →
  `uploadBufferToCloudinary`, returns `503` if unconfigured), SMTP via
  `nodemailer` (password reset is wired; console-logs the email body when
  `EMAIL_ENABLED=false`).
- **Local dev / self-host**: `docker-compose.yml` runs Mongo + Redis + API +
  nginx-served client together. `.github/workflows/ci.yml` already lints+tests
  the server (Jest) and lints+builds the client on every push/PR.
- **No root `package.json`** — `client/` and `server/` are independent npm
  projects with their own lockfiles.

## Deployment Blockers (things that will actually break in prod)

1. **CORS allows exactly one static origin**
   (`server/src/app.js:14-19`, `origin: env.clientUrl`). Fine for Docker
   Compose (one known origin), but a Vercel deploy needs the API to accept
   requests from the production frontend domain while `CLIENT_URL` is also
   still used elsewhere (password-reset email links). One string can't do
   both jobs safely.
2. **No `trust proxy` setting anywhere in `server/src`.** Render (like every
   PaaS) terminates TLS at a proxy in front of the app. `express-rate-limit@7`
   *throws* (`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`) when it sees an
   `X-Forwarded-For` header and `trust proxy` isn't set — meaning the
   `/api/auth/login` and `/api/auth/forgot-password` routes would hard-crash
   on first request on Render, not just misbehave.
3. **No graceful shutdown** (`server/server.js` — plain `app.listen`, no
   `SIGTERM` handling). Render sends `SIGTERM` on every redeploy/restart;
   without draining, in-flight requests get dropped mid-response instead of
   completing.
4. **JWT secrets silently fall back to hardcoded dev values**
   (`server/src/config/env.js:13,15`, `'dev_access_secret'` /
   `'dev_refresh_secret'`). Already flagged in the README's "before deploying
   this anywhere real" checklist as a manual step — worth making it
   impossible to forget rather than just documented, since forgetting it
   means anyone can forge a `SUPER_ADMIN` token.
5. **Only a liveness check exists** (`GET /api/health`, always returns 200
   regardless of DB/Redis state). Render's health check would report
   "healthy" even if Mongo never connected.
6. **No root `package.json`.** Not a blocker for Vercel/Render themselves
   (both deploy from a configured subdirectory, ignoring the repo root
   entirely), but makes "clone and run" harder than it should be, and there's
   no CI-adjacent way to build/lint both halves from one command.

## Security Issues (see SECURITY_REPORT.md for the full pass)

- Dev JWT secret fallback (above) — highest priority.
- In-memory rate limiter — already a documented, deliberate trade-off in
  `README.md` ("Trade-offs" section) for a single-instance deployment; still
  worth restating here since Render's free/starter tiers are single-instance
  anyway, so the trade-off holds as-is.
- No `trust proxy` compounds a second way beyond the rate-limit crash: without
  it, `req.ip` (used for `RefreshToken.createdByIp` and audit logs) resolves
  to the proxy's IP, not the client's, on Render.
- Nothing else materially new versus what the README already documents
  (secrets rotation, HTTPS requirement for `secure` cookies, no direct
  DB/Redis exposure) — those items were already correct guidance, just not
  yet enforced in code.

## Recommended Production Architecture

```
GitHub
  │
  ├── Vercel  (Root Directory: client/)  ── React static build, SPA rewrite
  │        env: VITE_API_BASE_URL = https://<render-service>.onrender.com/api
  │
  └── Render  (Root Directory: server/)  ── Express, Node runtime, NOT serverless
           │
           ├── MongoDB Atlas   (MONGO_URI)
           ├── Redis           (Render Key Value / Upstash — REDIS_URL, REDIS_ENABLED=true)
           ├── Cloudinary      (CLOUDINARY_*)
           └── SMTP            (SMTP_*, EMAIL_ENABLED=true)
```

Backend stays a normal long-running Express process — it already assumes a
persistent Mongo connection, in-process Redis client, and cookie-based
sessions, none of which map cleanly onto Vercel serverless functions without
a rewrite. Render (or Railway) is the correct target given the existing
`server/Dockerfile`.

## Priority Order

1. Fail fast on missing JWT secrets in production (security, one-line fix,
   prevents the worst-case outcome).
2. `trust proxy` — without it, auth routes crash on Render immediately.
3. Multi-origin CORS — without it, the deployed frontend can't call the API
   at all.
4. Graceful shutdown — correctness under Render's normal redeploy cycle.
5. `/api/ready` readiness probe (Mongo/Redis-aware) alongside the existing
   liveness `/api/health`.
6. Root `package.json` convenience scripts (`dev`, `build`, `lint`) — quality
   of life, not a blocker.
7. `render.yaml` + README Vercel/Render walkthrough — documentation/IaC so
   the deploy is repeatable without tribal knowledge.
