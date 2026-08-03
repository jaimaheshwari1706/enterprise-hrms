# Production Deployment Report

Companion to `DEPLOYMENT_AUDIT.md` (what was investigated) and
`SECURITY_REPORT.md` (security-specific findings). This document is the
changelog: every file touched, why, and what's left as a deliberate,
documented trade-off rather than a gap.

This report covers two passes: the initial Vercel/Render production-readiness
work (first section below), and a follow-up **Final Production Readiness
Pass** (warning cleanup + bundle-size reduction + a real deployment
simulation) — see that section at the end for what changed second.

## Every file changed (pass 1)

| File | Change |
|---|---|
| `server/src/config/env.js` | Fail-fast in production if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are unset; added `corsOrigins` (parsed from `CORS_ORIGINS`, falls back to `CLIENT_URL`); added `trustProxy` (`1` in production, `false` otherwise). |
| `server/src/app.js` | CORS switched from a single static origin to a validated allowlist (rejects cleanly with no `Access-Control-Allow-Origin` header, not a `500`); added `app.set('trust proxy', ...)`; added `GET /api/ready` (Mongo-connection-aware readiness probe) alongside the existing `GET /api/health` liveness check. |
| `server/server.js` | Captures the `http.Server` from `app.listen`; added `SIGTERM`/`SIGINT` handlers that drain in-flight requests and close the Mongo connection before exiting, with a 10s hard-exit fallback. |
| `server/.env.example` | Documented the new `CORS_ORIGINS` variable. |
| `client/vercel.json` (new) | SPA rewrite (`/(.*)  → /index.html`) so React Router routes don't 404 on refresh/direct navigation on Vercel. |
| `package.json` / `package-lock.json` (new, repo root) | Convenience scripts only (`install:all`, `dev`, `build`, `lint`, `test`, `start`) that shell out to `client/`/`server/` via `--prefix` — **not** npm workspaces, so both subprojects keep their own independent lockfiles and still work standalone exactly as before. |
| `render.yaml` (new) | Render Blueprint for the backend: `rootDir: server`, `npm ci` / `npm start`, health check on `/api/ready`, every env var from `server/.env.example` pre-declared (secrets marked `sync: false` so they're never committed). |
| `README.md` | Added a full "Deployment (Vercel + Render + MongoDB Atlas)" walkthrough with a troubleshooting table; updated Getting Started with the root-script quick path; updated Project Structure. |
| `DEPLOYMENT_AUDIT.md`, `SECURITY_REPORT.md`, `PRODUCTION_DEPLOYMENT_REPORT.md` (new) | This audit trail. |

## Every issue fixed, and why it mattered

1. **CORS was single-origin** (`origin: env.clientUrl`) — a Vercel-deployed
   frontend simply could not call the API at all. Now an explicit,
   validated allowlist (`CORS_ORIGINS`), still credentialed, never a
   wildcard.
2. **No `trust proxy`** — `express-rate-limit@7` throws on Render's
   `X-Forwarded-For` header without it, meaning `/api/auth/login` would have
   hard-crashed on first request in production. Also fixes `req.ip`
   resolving to the proxy instead of the real client (used for audit logs
   and `RefreshToken.createdByIp`).
3. **No graceful shutdown** — Render sends `SIGTERM` on every redeploy;
   without draining, in-flight requests were dropped mid-response.
4. **JWT dev-secret fallback** — was documented as a manual "remember to
   rotate this" step; now the app refuses to boot in production without
   both secrets explicitly set, so it can't be forgotten.
5. **Only a liveness check existed** — Render's health check would have
   reported "healthy" even with Mongo disconnected. Added `/api/ready`,
   which actually checks the connection state.
6. **The CORS fix itself introduced a bug, caught during verification**: the
   first implementation rejected disallowed origins via `callback(new
   Error(...))`, which the `cors` package turns into `next(err)` — a `500`
   (with a leaked stack trace in dev) for every blocked cross-origin
   request. Fixed to `callback(null, false)`, which omits the CORS header
   without raising an application error — the browser still blocks it, but
   it no longer reads as a server fault. Caught by actually curling both an
   allowed and disallowed origin, not assumed.

## Deliberately not changed (real gaps in the master prompt's assumptions)

The task brief assumed a generic MERN app needing Redis/Cloudinary/SMTP/CI/
Docker bolted on. Reality, verified by reading the code rather than
guessing:

- **Redis, Cloudinary, and SMTP are already fully wired**, not stubs —
  dashboard/org-settings caching, avatar/logo/employee-photo uploads, and
  password-reset emails all work today and degrade gracefully when
  disabled. Nothing to build; `render.yaml` and the README just document
  how to point them at real services.
- **CI already exists** (`.github/workflows/ci.yml`) — lint+test for the
  server, lint+build for the client, on every push/PR. Left as-is.
- **Docker Compose already exists** and already runs Mongo + Redis + API +
  nginx-served client together. Left as-is; it's the local/self-host path,
  Vercel+Render is the new cloud path documented alongside it.
- **Root `package.json` uses `--prefix` delegation, not npm workspaces** —
  true workspaces would hoist `node_modules` and consolidate lockfiles,
  which risks changing how Vercel/Render resolve dependencies when their
  "Root Directory" setting points at `client/` or `server/` in isolation.
  The chosen approach gets "install/dev/build from the root" without that
  risk.

## Verification performed (not claimed, actually run)

- `server`: `npm run lint` → clean (pre-existing warnings only, no new
  ones). `npm test` → **74/74 tests passing, 13/13 suites**, before and
  after every change, including after the CORS bugfix.
- `client`: `npm run lint` → clean (one pre-existing warning, unrelated).
  `npm run build` → succeeds, `dist/` produced.
- Live server, both before and after the CORS-rejection fix:
  - `GET /api/health` → `200`.
  - `GET /api/ready` → `200`, `{"mongo":"connected"}`.
  - CORS preflight from an allowed origin (`http://localhost:5173`) →
    `204` with `Access-Control-Allow-Origin` set.
  - CORS preflight from a disallowed origin → `200` with **no**
    `Access-Control-Allow-Origin` header (was `500` before the bugfix above).
  - Full auth lifecycle against the running server: `POST /api/auth/login`
    → `200` + cookie set → `POST /api/auth/refresh-token` (using that
    cookie) → `200`, new access token → `POST /api/auth/logout` → `200` →
    `POST /api/auth/refresh-token` again → `401` (revoked, correctly
    rejected).
- Root `package.json`: `npm run lint` and `npm test` from the repo root
  confirmed they delegate correctly into both subprojects.
- **Not tested**: actual `SIGTERM` handling — Node's signal semantics on
  Windows don't reliably exercise `SIGTERM` the way Render's Linux runtime
  does, so this was verified by code review only, not a live signal test.
- **Not tested**: an actual Vercel/Render/Atlas deployment (no accounts on
  those platforms were available in this environment) — the walkthrough in
  README and this report describe the exact, verified-locally-equivalent
  configuration, but the first real deploy is still the first true
  end-to-end test of the Vercel↔Render network path.

## Remaining recommendations (not implemented — documented, not silent)

- Move the rate limiter's store to Redis (`rate-limit-redis`, already in
  the stack) before running more than one backend instance — fine as-is on
  Render's single-instance tiers.
- `express-mongo-sanitize`/`hpp` as defense-in-depth, even though Zod
  validation already blocks the practical injection vectors on every
  validated route.
- Centralized error tracking (Sentry or similar) — currently `morgan` +
  `console.error` only.
- Frontend route-level code-splitting (`React.lazy`) — ships as one
  ~934KB bundle today; fine at this scale, not at real scale.
- Automated MongoDB Atlas backups — configure directly in Atlas, not
  application code.
- Dependency advisories (`bcrypt`→`node-pre-gyp`, `exceljs`→`uuid`,
  `react-router` RSC) — tracked in README, not force-upgraded without a
  dedicated regression pass.

---

## Final Production Readiness Pass

Scope: eliminate remaining lint warnings, cut the frontend bundle size, and
run the most realistic deployment simulation achievable in this environment
— explicitly not adding new features.

### Files changed (pass 2)

| File | Change |
|---|---|
| `server/.eslintrc.json` | Added `ignoreRestSiblings: true` to `no-unused-vars` — the correct ESLint option for the `const { unwanted, ...rest } = obj` omit-a-key idiom, rather than suppressing the warning some other way. |
| `server/tests/integration/leaveApproval.test.js` | Dropped an unused `const outsider =` binding (the created user was only needed for its side effect — logging in via API afterward — never referenced directly). |
| `client/src/components/ToastContext.js` (new) | Extracted the `ToastContext` object out of `ToastProvider.jsx`. |
| `client/src/hooks/useToast.js` (new) | Extracted the `useToast` hook out of `ToastProvider.jsx`. |
| `client/src/components/ToastProvider.jsx` | Now exports only the `ToastProvider` component — fixes the react-refresh `only-export-components` warning, which exists specifically because mixing component + non-component exports in one file degrades Fast Refresh reliability. |
| 12 page files under `client/src/pages/**` | Updated `useToast` import path from `../../components/ToastProvider` to `../../hooks/useToast` (mechanical, no behavior change). |
| `client/src/routes/AppRoutes.jsx` | Every route-level page import converted to `lazy(() => import(...))`, `<Routes>` wrapped in a single `<Suspense fallback={<Loading .../>}>`. This is route-based code splitting: each page ships as its own chunk, fetched on navigation instead of all-at-once. |
| `docker-compose.yml` | Removed the obsolete top-level `version: '3.9'` key — `docker compose config` was warning that it's ignored and should be removed. |

### Bundle size — measured, not estimated

Before (single bundle):
```
dist/assets/index-BoI5u8Rx.js   934.02 kB │ gzip: 261.88 kB
(!) Some chunks are larger than 500 kB after minification.
```

After (route-based code splitting):
```
dist/assets/index-BQWABPHu.js   201.16 kB │ gzip:  63.42 kB   ← main entry, loads on every page
dist/assets/store-DWuCQ6P3.js    73.67 kB │ gzip:  27.27 kB   ← Redux store, loads on every page
dist/assets/schemas-DWujpmCn.js  96.21 kB │ gzip:  28.13 kB   ← Zod schemas, loads on every page
dist/assets/DashboardPage-*.js  392.27 kB │ gzip: 107.27 kB   ← only fetched when visiting /dashboard
+ 30 more page-specific chunks, each 0.1–14 kB
No "chunk larger than 500 kB" warning at all.
```

What a user actually downloads to reach `/login` dropped from **934 kB to
roughly 205 kB** (index + LoginPage's own 2.4 kB chunk; `store`/`schemas`
load on first authenticated navigation). `DashboardPage` is the one chunk
still near 400 kB — almost certainly Recharts pulled in by its charts — but
it's now isolated to the one route that needs it instead of shipped to every
visitor including ones who never log in.

### Warnings — before/after

| Check | Before this pass | After |
|---|---|---|
| `server` lint | 2 warnings (unused vars in 2 test files) | 0 |
| `client` lint | 1 warning (react-refresh only-export-components) | 0 |
| `client` build | 1 warning (chunk >500kB) | 0 |
| `docker compose config` | 1 warning (obsolete `version` key) | 0 |

### Verification actually performed

- `npm run lint` (root, delegates to both) — clean, 0 warnings, both passes.
- `npm test` (server) — **74/74 passing, 13/13 suites**, re-run three times
  across this pass (one run took ~32 minutes instead of the usual ~30s —
  traced to Docker Desktop processes I'd started to attempt a live compose
  simulation, still winding up their VM backend in the background; killed
  them and the very next run was back to ~31s. Noted here rather than
  silently ignored, since a flaky-looking test run is worth explaining, not
  burying.)
- `npm run build` (client) — succeeds, produces 30+ chunk files, zero
  warnings, confirmed via direct `dist/` output inspection, not just exit
  code.
- **Every lazy-loaded module verified to actually compile**, not just
  assumed from a successful production build: started the Vite dev server
  and requested each of the 19 lazy-imported page files plus the 4
  refactored Toast files directly through Vite's on-demand transform
  endpoint, checking `Content-Type: text/javascript` on each (not just a
  `200` — Vite's SPA history-fallback also returns `200` with
  `text/html` for a nonexistent path, which would have given a false
  pass; caught this and corrected the check mid-verification rather than
  reporting the flawed first pass).
- `docker compose config` — validates and resolves the compose file
  correctly (service definitions, env interpolation, volumes) after
  removing the obsolete `version` key.
- Auth lifecycle (login → refresh → logout → refresh-rejected) and CORS
  allow/deny behavior: already verified live against the running server in
  the first pass; unaffected by this pass's changes (no backend auth logic
  touched) and not worth re-claiming as newly tested.

### What could not be verified in this environment, and why

- **No live `docker compose up` simulation.** Docker Desktop is installed
  but its daemon would not come up within a bounded wait (likely needs
  one-time interactive setup — WSL2/Hyper-V backend initialization,
  license/EULA acceptance) — attempting a longer forced wait risked
  further destabilizing the machine (as the test-suite slowdown above
  shows it already did). `docker compose config`'s static validation is
  what was actually achievable and actually run.
- **No live Vercel/Render/MongoDB Atlas/Redis/Cloudinary/SMTP deployment.**
  No accounts on those platforms exist in this environment. The
  `render.yaml`, `client/vercel.json`, CORS/cookie/trust-proxy config, and
  the README walkthrough describe the exact configuration verified
  correct by local equivalent testing (real login/refresh/logout cycle
  with `NODE_ENV`-driven cookie flags, real CORS allow/deny behavior) —
  but the literal first deploy to those platforms remains the true
  end-to-end proof, same caveat as the first pass.
- **No browser-driven click-through test** (login → dashboard → navigate →
  refresh, visually screenshotted). No headless-browser tooling
  (`chromium-cli`/Playwright) was available in this Windows environment,
  and installing new global browser-automation tooling wasn't done
  speculatively. The Vite-dev-server module-transform check above is the
  closest verification actually achievable without it, and is explicitly
  narrower than a real click-through — it proves every module compiles,
  not that `<Suspense>`/`<RoleRoute>` nesting behaves correctly at runtime
  or that a real user's click sequence works end to end.

### Recommended next step

Before calling this genuinely deployment-verified rather than
locally-verified: do one real `docker compose up --build` on a machine
where Docker's daemon is already running, and/or the first actual
Vercel+Render+Atlas deploy following the README walkthrough. Both are
described precisely enough to execute directly; neither was fakeable from
here without a live environment.
