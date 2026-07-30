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
- [Screenshots checklist](#screenshots-checklist)

---

## Features

- **Authentication** — JWT access + refresh tokens (refresh token rotated + revocable, stored hashed), forgot/reset password, rate-limited login
- **RBAC** — 4 roles (`SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`), enforced on both frontend routes and backend APIs — including query-level scoping (a manager can't bypass their team filter by editing the URL)
- **Organization / Departments / Designations** — full CRUD, logo upload, delete-guards against orphaned references
- **Employee management** — CRUD with auto-provisioned login + emailed temp credentials, profile photo upload, search/filter/pagination, Overview/Personal/Job/Attendance/Leave/Payroll detail tabs
- **Attendance** — check-in/check-out, automatic working-hours + Present/HalfDay derivation, team view for HR/Managers
- **Leave management + generic approval workflow** — apply/cancel/approve/reject, a reusable `Approval` model (not hard-coded to leave — could support future request types), approved leave auto-populates attendance as "Leave"
- **Payroll** — configurable salary structure per employee, monthly generation (skips duplicates), Draft → Processed → Paid status flow
- **Role-specific dashboards** — HR (org-wide + 4 Recharts visualizations, Redis-cached), Manager (team-scoped), Employee (personal)
- **Notifications** — in-app, API-polled (no WebSockets)
- **Email** — account creation, leave submitted/approved/rejected, payroll generated, password reset (logs to console instead of sending when disabled)
- **Audit logs** — every meaningful action recorded and searchable
- **Global search** — quick employee lookup from the navbar
- **Excel export** — employees, attendance, leave, payroll (respects active filters)
- **Redis caching** — cache-aside pattern on the HR dashboard and organization info, with invalidation on writes; app works fine with Redis disabled
- **Dark mode**, responsive layout (mobile drawer sidebar), loading/empty/error states throughout

## Tech stack

**Frontend:** React 19 + Vite, React Router, Redux Toolkit, Axios, React Hook Form + Zod, Tailwind CSS v4, Recharts, lucide-react

**Backend:** Node.js + Express, MongoDB + Mongoose, JWT, bcrypt, Redis (ioredis), Cloudinary, Nodemailer, ExcelJS, Zod

**Testing:** Jest, Supertest, mongodb-memory-server

**Dev/Deploy:** ESLint, Docker + Docker Compose, environment-variable driven config

No TypeScript, GraphQL, microservices, or Kubernetes by design — see the [Architecture](#architecture) section for why.

## Architecture

This project was built in 12 phases (Phase 0: analyzing two much larger reference projects, Phase 1: architecture design, Phases 2–11: incremental builds, Phase 12: this polish pass). A few deliberate scope decisions worth knowing:

- **User vs. Employee are separate models.** `User` is the login identity (email/password/role); `Employee` is the HR profile (department, salary, etc). This lets `SUPER_ADMIN` exist without an HR record and mirrors how most real HRMS platforms split auth from HR data.
- **One generic `Approval` model**, not a leave-specific one. Only `LeaveRequest` uses it today (`requestType: 'LEAVE'`), but the shape (`requestType` + `requestId`) means a future request type could reuse it without a new workflow engine.
- **Attendance and Leave share data.** Approved leave writes `Attendance` records with `status: 'Leave'` — no separate "who's on leave today" bookkeeping needed.
- **Manager scoping is enforced server-side**, not just hidden in the UI. Every team-scoped endpoint validates that an explicit `employee` filter is actually within the manager's team before applying it (this was a real bug caught and fixed during Phase 8/9 — worth mentioning if asked about testing/security in an interview).
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

## Environment variables

### `server/.env`

| Variable | Description | Required |
|---|---|:---:|
| `MONGO_URI` | MongoDB connection string | ✅ |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets — change these before any real deployment | ✅ |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | Token lifetimes (default `15m` / `7d`) | — |
| `REDIS_ENABLED` | `true`/`false` — app works fine either way | — |
| `REDIS_URL` | Only used if `REDIS_ENABLED=true` | — |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | For logo/profile image uploads — uploads return a clear error if unset, nothing crashes | — |
| `EMAIL_ENABLED` | `true`/`false` — emails are logged to the console when `false` | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Only used if `EMAIL_ENABLED=true` | — |
| `CLIENT_URL` | Used for CORS + email links | ✅ |

### `client/.env`

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (default `http://localhost:5000/api`) |

**Cloudinary setup:** create a free account at cloudinary.com, grab your Cloud Name/API Key/API Secret from the dashboard, paste them into `server/.env`.

**Redis setup:** install locally (`redis-server`) or use a free hosted instance (e.g. Upstash), set `REDIS_ENABLED=true` and `REDIS_URL`.

**Email setup:** any SMTP provider works (Gmail with an app password, Mailtrap for testing, SendGrid, etc). Set `EMAIL_ENABLED=true` and fill in the SMTP fields.

## Demo data & accounts

```bash
cd server && npm run seed
```

This is **destructive** (clears the collections it seeds) — only run it against a database you're fine wiping. It creates a full organization with departments, designations, 1 Super Admin, 1 HR Admin, 2 Managers, 15 employees, salaries, ~2 weeks of attendance, a mix of leave requests, and 3 months of payroll.

All seeded accounts share the password **`Demo@1234`**:

| Role | Email |
|---|---|
| SUPER_ADMIN | `admin@hrms.local` |
| HR_ADMIN | `hr@hrms.local` |
| MANAGER (Engineering) | `arjun.mehta@hrms.local` |
| MANAGER (Sales) | `sara.khan@hrms.local` |
| EMPLOYEE | `rohan.verma@hrms.local` (+ 14 more — see `server/src/seed/seed.js`) |

Log in as `hr@hrms.local` first to see the fullest picture (dashboards, pending approvals, payroll history all populated).

## Testing

```bash
cd server && npm test
```

- **Unit tests** (47, no DB required): JWT tokens, password hashing, pagination math, and — the priority areas for this project — leave day calculation, attendance status derivation, and payroll gross/net calculation.
- **Integration tests**: full API tests via Supertest against an in-memory MongoDB, covering auth, RBAC boundaries, employee CRUD, the leave apply→approve flow, and payroll generation. First run downloads a MongoDB binary (needs internet access).

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
- MongoDB and Redis run as internal services (also exposed on their default ports for local inspection)

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
