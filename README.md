# Enterprise HRMS

A portfolio-grade **Enterprise HR Management System** built with the MERN stack (MongoDB, Express, React, Node.js) — think a simplified Zoho People / Keka. It covers the full employee lifecycle: authentication & RBAC, org structure, employee records, attendance, leave with approvals, payroll, role-specific dashboards with charts, notifications, audit logs, global search, and Excel export.

Built as a structured, interview-defensible full-stack project — every module is intentionally kept **simple and explainable** rather than maximally "enterprise," per the project's own scope decisions (see [Architecture](#architecture) below).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Demo data & accounts](#demo-data--accounts)
- [Testing](#testing)
- [API overview](#api-overview)
- [Docker deployment](#docker-deployment)
- [Going live — production checklist](#going-live--production-checklist)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Screenshots checklist](#screenshots-checklist)

---

## Features

- **Authentication** — JWT access token (kept in memory, never in `localStorage`) + refresh token (rotated on every use, stored hashed in MongoDB, delivered as an httpOnly cookie), forgot/reset password, rate-limited login
- **RBAC** — 4 roles (`SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`), enforced on both frontend routes and backend APIs — including query-level scoping (a manager can't bypass their team filter by editing the URL)
- **Organization / Departments / Designations** — full CRUD, logo upload, delete-guards against orphaned references
- **Employee management** — CRUD with auto-provisioned login + emailed temp credentials, profile photo upload, search/filter/pagination, Overview/Personal/Job/Attendance/Leave/Payroll detail tabs
- **Attendance** — check-in/check-out, automatic working-hours + Present/HalfDay derivation, team view for HR/Managers
- **Leave management + generic approval workflow** — apply/cancel/approve/reject, a reusable `Approval` model (not hard-coded to leave — could support future request types), approved leave auto-populates attendance as "Leave"
- **Payroll** — configurable salary structure per employee, monthly generation (skips duplicates), Draft → Processed → Paid status flow, gross/net always computed server-side
- **Role-specific dashboards** — HR (org-wide + 4 Recharts visualizations, Redis-cached), Manager (team-scoped), Employee (personal)
- **Notifications** — in-app, API-polled (no WebSockets)
- **Email** — account creation, leave submitted/approved/rejected, payroll generated, password reset (logs to console instead of sending when disabled)
- **Audit logs** — every meaningful action recorded and searchable
- **Global search** — quick employee lookup from the navbar
- **Excel export** — employees, attendance, leave, payroll (respects active filters)
- **Redis caching** — cache-aside pattern on the HR dashboard and organization info, with invalidation on every write; app works fine with Redis disabled
- **Dark mode**, responsive layout (mobile drawer sidebar), loading/empty/error states throughout

## Tech stack

**Frontend:** React 19 + Vite, React Router, Redux Toolkit, Axios, React Hook Form + Zod, Tailwind CSS v4, Recharts, lucide-react

**Backend:** Node.js + Express, MongoDB + Mongoose, JWT, bcrypt, Redis (ioredis), Cloudinary, Nodemailer, ExcelJS, Zod

**Testing:** Jest, Supertest, mongodb-memory-server

**Dev/Deploy:** ESLint (backend) + oxlint (frontend), Docker + Docker Compose, environment-variable driven config

No TypeScript, GraphQL, microservices, or Kubernetes by design — see the [Architecture](#architecture) section for why.

## Architecture

A few deliberate scope decisions worth knowing:

- **User vs. Employee are separate models.** `User` is the login identity (email/password/role); `Employee` is the HR profile (department, salary, etc). This lets `SUPER_ADMIN` exist without an HR record and mirrors how most real HRMS platforms split auth from HR data.
- **One generic `Approval` model**, not a leave-specific one. Only `LeaveRequest` uses it today (`requestType: 'LEAVE'`), but the shape (`requestType` + `requestId`) means a future request type could reuse it without a new workflow engine.
- **Attendance and Leave share data.** Approved leave writes `Attendance` records with `status: 'Leave'` — no separate "who's on leave today" bookkeeping needed.
- **Manager scoping is enforced server-side**, not just hidden in the UI. Every team-scoped endpoint validates that an explicit `employee` filter is actually within the manager's team before applying it.
- **Access tokens are short-lived (15m) and held only in memory** (Redux state); the refresh token is long-lived (7d), rotated on every use, stored **hashed** (never raw) in MongoDB so a single session can be revoked without invalidating every other session, and delivered as an httpOnly cookie the frontend JS never touches directly.
- **Redis and Cloudinary are both optional in development.** The app runs correctly with either disabled — Redis falls back to a no-op cache client, uploads fail with a clear 503 rather than crashing.

### RBAC matrix

| Action | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| Manage Organization | ✅ | ✅ | ❌ | ❌ |
| Departments/Designations CRUD | ✅ | ✅ | view | view |
| Employees CRUD | ✅ | ✅ | view team | view self |
| Attendance check-in/out | ✅ | ✅ | ✅ | ✅ |
| View all attendance | ✅ | ✅ | team only | self only |
| Apply leave | ✅ | ✅ | ✅ | ✅ |
| Approve/reject leave | ✅ | ✅ (fallback) | direct reports | ❌ |
| Configure salary / generate payroll | ✅ | ✅ | ❌ | ❌ |
| View own payroll | ✅ | ✅ | ✅ | ✅ |
| Audit logs / Excel export | ✅ | ✅ | ❌ | ❌ |

## Folder structure

```
enterprise-hrms/
├── client/                    React + Vite frontend
│   └── src/
│       ├── api/                 axios instance + one module per resource
│       ├── app/                 Redux store
│       ├── components/          reusable UI (Modal, Button, Table bits, Toast, ...)
│       ├── features/            Redux slices (auth, theme, notifications)
│       ├── hooks/                useDebounce, etc.
│       ├── layouts/              DashboardLayout (sidebar+navbar), AuthLayout
│       ├── pages/                route-level pages, grouped by module
│       └── routes/               AppRoutes, ProtectedRoute, RoleRoute
├── server/                    Express backend
│   └── src/
│       ├── config/               env, db, redis, cloudinary
│       ├── controllers/          one per resource
│       ├── middleware/           auth, rbac, validate, upload, errorHandler, rateLimiter
│       ├── models/                14 Mongoose schemas
│       ├── routes/                one per resource, mounted in routes/index.js
│       ├── services/              auditService, emailService, notificationService
│       ├── seed/                  demo data + minimal admin/leave-type seeders
│       ├── utils/                 tokens, pagination, extracted business-logic calculators
│       └── validations/           Zod schemas per resource
│   └── tests/
│       ├── unit/                  pure logic, no DB
│       └── integration/           Supertest + in-memory MongoDB
├── docker-compose.yml
├── BUGS.md, *_TEST_REPORT.md      internal QA records (see Testing section)
└── README.md
```

## Local setup

### Prerequisites
- Node.js 20+ (built/tested on Node 22)
- MongoDB (local `mongod` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- Optional: Redis, Cloudinary account, SMTP credentials

### Backend

```bash
cd server
cp .env.example .env      # edit MONGO_URI and any other values you need
npm install
npm run seed                # populates realistic demo data (see below)
npm run dev                  # http://localhost:5000/api/health
```

### Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### Quality checks

```bash
cd server && npm run lint && npm test   # ESLint + Jest (unit + integration)
cd client && npm run lint && npm run build   # oxlint + production build
```

## Environment variables

### `server/.env`

| Variable | Description | Required |
|---|---|:---:|
| `MONGO_URI` | MongoDB connection string | ✅ |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets — **must** be changed to long random values before any real deployment (see [Going live](#going-live--production-checklist)) | ✅ |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | Token lifetimes (default `15m` / `7d`) | — |
| `REDIS_ENABLED` | `true`/`false` — app works fine either way | — |
| `REDIS_URL` | Only used if `REDIS_ENABLED=true` | — |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | For logo/profile image uploads — uploads return a clear `503` if unset, nothing crashes | — |
| `EMAIL_ENABLED` | `true`/`false` — emails are logged to the console when `false` | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Only used if `EMAIL_ENABLED=true` | — |
| `CLIENT_URL` | The frontend's exact origin — used for CORS (`Access-Control-Allow-Origin`) and email links. Must be an exact scheme+host+port match; there is no wildcard/multi-origin support | ✅ |
| `NODE_ENV` | `development` or `production` — controls cookie `secure`/`sameSite` flags and whether stack traces are included in 5xx responses | ✅ |

### `client/.env`

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (default `http://localhost:5000/api`). **Baked in at build time** — see the Docker section. |

**Cloudinary setup:** create a free account at cloudinary.com, grab your Cloud Name/API Key/API Secret from the dashboard, paste them into `server/.env`.

**Redis setup:** install locally (`redis-server`) or use a free hosted instance (e.g. Upstash), set `REDIS_ENABLED=true` and `REDIS_URL`.

**Email setup:** any SMTP provider works (Gmail with an app password, Mailtrap for testing, SendGrid, etc). Set `EMAIL_ENABLED=true` and fill in the SMTP fields.

## Demo data & accounts

```bash
cd server && npm run seed
```

⚠️ **This is destructive** — it clears every collection it seeds before inserting fresh demo data. Only ever run it against a database you're fine wiping. **Never run it against a database that has real employee/user data in it.**

It creates a full organization with departments, designations, 1 Super Admin, 1 HR Admin, 2 Managers, 15 employees, salaries, ~2 weeks of attendance, a mix of leave requests, and 3 months of payroll.

All seeded accounts share the password **`Demo@1234`**:

| Role | Email |
|---|---|
| SUPER_ADMIN | `admin@hrms.local` |
| HR_ADMIN | `hr@hrms.local` |
| MANAGER (Engineering) | `arjun.mehta@hrms.local` |
| MANAGER (Sales) | `sara.khan@hrms.local` |
| EMPLOYEE | `rohan.verma@hrms.local` (+ 14 more — see `server/src/seed/seed.js`) |

Log in as `hr@hrms.local` first to see the fullest picture (dashboards, pending approvals, payroll history all populated).

🔒 **This password is published in this README.** If you seed a publicly-reachable environment for demo purposes, treat every one of these accounts as compromised by default — see [Going live](#going-live--production-checklist).

## Testing

```bash
cd server && npm test
```

- **Unit tests** (47, no DB required): JWT tokens, password hashing, pagination math, and — the priority areas for this project — leave day calculation, attendance status derivation, and payroll gross/net calculation.
- **Integration tests** (27, via Supertest + in-memory MongoDB): auth, RBAC boundaries, employee CRUD, the leave apply→approve flow, and payroll generation. First run downloads a MongoDB binary (needs internet access). Runs single-worker (`maxWorkers: 1` in `jest.config.js`) — several suites each spin up their own in-memory MongoDB instance, and running them fully in parallel can exceed the instance-startup timeout on modest hardware.

This project has also been through a full manual QA pass (auth lifecycle, RBAC, every CRUD module, uploads, pagination/search/filters, dashboards, exports). See `BUGS.md`, `API_TEST_REPORT.md`, `RBAC_TEST_REPORT.md`, and `TEST_REPORT.md` in the repo root for the detailed findings, fixes, and verification steps from that pass — useful reading before you rely on this in production, and a decent artifact to point to in an interview.

## API overview

All responses follow `{ success, message, data, pagination? }`. Base path: `/api`.

| Resource | Base path | Notes |
|---|---|---|
| Auth | `/auth` | login, logout, refresh-token, me, forgot/reset-password |
| Organization | `/organization` | get, update, logo upload |
| Departments / Designations | `/departments`, `/designations` | full CRUD |
| Employees | `/employees` | CRUD, `/search` quick search, `/:id/status`, `/:id/profile-image` |
| Attendance | `/attendance` | check-in/out, `/me/today`, `/me/history`, team list |
| Leaves | `/leaves` | leave-types, apply, `/me`, cancel, team list, approve/reject |
| Payroll | `/payroll` | salary config, generate, list, `/me`, status update |
| Dashboard | `/dashboard` | `/hr`, `/manager`, `/employee` |
| Notifications | `/notifications` | list, mark read, mark all read |
| Audit Logs | `/audit-logs` | HR/Admin only |
| Profile | `/profile` | self view/update, change password, avatar |
| Export | `/export` | employees/attendance/leaves/payroll `.xlsx` |

## Docker deployment

A full stack — MongoDB, Redis, the API, and the frontend (built + served via nginx) — is defined in the root `docker-compose.yml`.

```bash
# from the project root
docker compose up --build
```

- API: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- MongoDB and Redis run as internal services (also exposed on their default ports for local inspection — **do not** ship this as-is to a public host, see below)

Override secrets via a `.env` file in the project root (read by Compose) or environment variables before running:

```bash
JWT_ACCESS_SECRET=your_real_secret JWT_REFRESH_SECRET=your_real_secret docker compose up --build
```

Once the stack is up, seed demo data by running the seed script inside the running server container:

```bash
docker compose exec server npm run seed
```

**Note on Cloudinary image uploads in Docker:** the client's `VITE_API_BASE_URL` is baked into the JS bundle at build time (Vite env vars aren't available at runtime), so if you deploy the API somewhere other than `localhost:5000`, rebuild the client image with `--build-arg VITE_API_BASE_URL=https://your-api-domain/api`.

For a cloud deployment (Render, Railway, Fly.io, etc.), the same two Dockerfiles work as-is — just point `MONGO_URI` at MongoDB Atlas and set real JWT secrets.

## Going live — production checklist

The docker-compose file and `.env.example` defaults in this repo are tuned for **local development**, not a public deployment. Work through this list before pointing a real domain at it.

### Must do (skipping these is a real security hole)

1. **Rotate both JWT secrets.** Generate long random values — e.g. `openssl rand -hex 64` — for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, and never reuse the `change_this_*` placeholders. Anyone who knows those placeholder strings (they're in this public README/repo) can forge a valid token for any user, including `SUPER_ADMIN`, if you deploy with the defaults still in place.
2. **Serve everything over HTTPS.** In production (`NODE_ENV=production`) the refresh-token cookie is set with `secure: true` and `sameSite: 'none'`. Browsers will silently refuse to store or send that cookie over plain HTTP — login will appear to work, and then **every page refresh will log the user out**, because the session-restore cookie was never actually saved. Terminate TLS at a reverse proxy / load balancer (or rely on your host's default, e.g. Render/Railway/Fly all provide this) in front of both the API and the frontend.
3. **Set `CLIENT_URL` to your exact production frontend origin** (scheme + host + port). CORS here only allows a single configured origin with credentials — there's no wildcard.
4. **Never expose MongoDB or Redis directly to the internet.** The shipped `docker-compose.yml` maps `27017` and `6379` straight to the host with no authentication — that's fine on your own laptop, but if you run that same compose file on a public cloud VM, you've just handed out an unauthenticated database. Use a managed, authenticated MongoDB (Atlas) and Redis (Upstash, or a same-VPC instance with a password), or at minimum bind those ports to `127.0.0.1`/an internal network only.
5. **Don't seed real environments.** `npm run seed` wipes the collections it touches first — never run it against a database with real employee data. If you use it to stand up a public demo, immediately rotate every seeded account's password (they're all `Demo@1234`, published in this file) or delete the demo accounts entirely before onboarding real users.
6. **Double-check `.env` files never get committed.** They're already gitignored (`server/.env`, `client/.env`); just confirm before your first push to a new remote, especially if you've copied this repo anywhere.

### Should do (real gaps at real scale)

7. **Configure Cloudinary** (all three keys) if you want profile photo / organization logo uploads to actually work — without them the endpoints correctly return a clean `503` rather than crashing, but the feature is effectively off.
8. **Configure real SMTP** and set `EMAIL_ENABLED=true` if you want password-reset and workflow emails to actually send — otherwise they're only ever logged to the server's stdout.
9. **Move the rate limiter's store to Redis if you run more than one server instance.** `authLimiter` (`server/src/middleware/rateLimiter.js`) uses `express-rate-limit`'s default in-memory store, keyed per-process — behind a load balancer with multiple instances, an attacker's requests get spread across instances and the 20-requests/15-minutes limit is trivially bypassed. Swap in `rate-limit-redis` (Redis is likely already in your stack) once you scale beyond one instance.
10. **Enable Redis in production** (`REDIS_ENABLED=true`) for the HR dashboard/organization cache-aside path — optional (the app is correct without it), but reduces MongoDB load under real traffic.
11. **Set up automated MongoDB backups.** Atlas does this for you out of the box; a self-hosted instance needs a scheduled `mongodump` (or equivalent) before you have real payroll/employee data you can't afford to lose.
12. **Wire up centralized logging and error tracking.** `morgan('combined')` writes access logs to stdout in production — pipe that into whatever your host provides. No error-tracking service (Sentry, etc.) is wired up; consider adding one so a 500 in production doesn't go unnoticed.

### Nice to have

13. The frontend currently ships as a single ~934KB JS bundle (Vite's build warns about this — no route-level code-splitting yet). It works correctly, just adds to first-load time on slow connections. Worth a follow-up (`React.lazy` + route-based splitting) if performance under real traffic matters to you, but it's not a blocker.

## Security notes

- Passwords are hashed with bcrypt (10 salt rounds); never logged or returned by any API (`select: false` on the schema field).
- Refresh tokens are stored **hashed** (SHA-256) in MongoDB, never in plaintext — a database dump alone doesn't hand out usable sessions.
- Refresh tokens rotate on every use (old one revoked, new one issued) and are revoked on logout and on password reset (so a stolen token stops working the moment the real user changes their password).
- `helmet()` is applied globally; centralized error handling never returns stack traces or raw database errors outside `NODE_ENV=development`.
- Every sensitive backend endpoint enforces its role check server-side, independent of what the frontend UI happens to show or hide — verified directly in `RBAC_TEST_REPORT.md`.

## Known limitations

- Single-tenant by design — one `Organization` document per deployment, not a multi-tenant SaaS.
- Notifications are polled (every 30s), not pushed via WebSockets.
- No automated end-to-end browser test suite (Playwright/Cypress) — coverage is unit + integration (Jest/Supertest) at the API layer plus manual QA; see `TEST_REPORT.md`.
- No code-splitting on the frontend build yet (see item 13 above).

## Screenshots checklist

For a portfolio README or case study, capture:

- [ ] Login page
- [ ] HR dashboard (with charts populated via demo data)
- [ ] Manager dashboard
- [ ] Employee dashboard
- [ ] Employees list (search/filter/pagination visible)
- [ ] Employee detail page (Overview tab + one other tab, e.g. Payroll)
- [ ] Add/Edit employee form
- [ ] Attendance check-in/out widget
- [ ] Team attendance table with filters
- [ ] Leave application form (modal)
- [ ] Leave approvals page with the decision modal open
- [ ] Payroll management (records tab + salary config tab)
- [ ] Organization settings page
- [ ] Audit logs page
- [ ] Notification dropdown open
- [ ] Global search dropdown with results
- [ ] Dark mode variant of at least 2–3 of the above
- [ ] Mobile view (drawer sidebar open) of the dashboard
