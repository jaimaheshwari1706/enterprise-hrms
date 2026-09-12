# Enterprise HRMS — Architecture & Production-Readiness Audit

Date: 2026-09-12
Scope: complete repository (server, client, database schemas, DevOps config).
Baseline before changes: server lint clean, 74/74 Jest tests passing, client lint clean, client build OK.

Legend — **P0** critical (security / data integrity / crashes / wrong business results), **P1** important (reliability, maintainability, performance, UX), **P2** enhancement (polish).

---

## Architecture summary (what exists today)

- **Server**: Express 4 + Mongoose 8, layered as `routes → (validate/auth/rbac middleware) → controllers → models`, with small `services/` (audit, email, notifications) and pure `utils/` (calculations, pagination, tokens). Zod validates request bodies. Central `errorHandler`. JWT access token (15m, header) + rotated refresh token (7d, httpOnly cookie, SHA-256 hashed in Mongo). Roles: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`. Optional Redis cache (no-op when disabled), Cloudinary uploads, SMTP email — all degrade gracefully.
- **Client**: React 19 + Vite 8 + Tailwind v4, Redux Toolkit for auth/theme, react-hook-form + zod for forms, axios instance with silent refresh + request queueing, route-level code splitting, recharts dashboard.
- **DB**: 14 collections. Attendance keyed by `(employee, date)` with `date` = midnight. Payroll keyed by `(employee, month)`. Leave → Approval record. Audit log on mutations.
- **Deploy**: Render (server, `/api/ready` health check), Vercel (client), MongoDB Atlas. Docker Compose for local. GitHub Actions CI (lint + test + build).

The codebase is well-commented and consistent. The issues below are real gaps, not stylistic nitpicks.

---

## P0 — Critical

### P0-1 Employee personal data exposed to every authenticated user (IDOR / over-exposure)
- **Path**: `server/src/routes/employee.routes.js`, `server/src/controllers/employee.controller.js` (`listEmployees`, `getEmployee`)
- **Current**: `GET /api/employees` and `GET /api/employees/:id` are open to all roles. The route comment says "EMPLOYEE effectively only ever fetches their own record via /profile", but nothing enforces it. Any `EMPLOYEE` can fetch any colleague's full record: DOB, home address, phone, manager, employment type.
- **Why it matters**: PII leak; an HRMS must restrict personal fields to HR and the person themselves.
- **Fix**: Role-based projection. EMPLOYEE (and MANAGER for non-reports) gets a "directory" view (name, ID, email, department, designation, photo, status); full record only for HR/SUPER_ADMIN, the direct manager, or self.
- **Risk**: Low — the employee directory list still works; only sensitive fields are hidden.

### P0-2 Unescaped user input compiled into regular expressions (ReDoS / regex injection)
- **Path**: `employee.controller.js` (`quickSearch`, `listEmployees`), `designation.controller.js`, `auditLog.controller.js`, `export.controller.js`
- **Current**: `new RegExp(search, 'i')` with raw query string. `search=(a+)+$` style input can hang the event loop; `.*` matches everything.
- **Fix**: Escape regex metacharacters in a shared helper; cap search length.
- **Risk**: None.

### P0-3 Attendance / leave "today" uses the server's local timezone, not the organization's
- **Path**: `server/src/utils/dateHelpers.js` (`startOfDay`), used by attendance check-in/out, leave→attendance marking, dashboards
- **Current**: `new Date().setHours(0,0,0,0)` — on Render the process runs in UTC. An employee in Asia/Kolkata checking in at 02:00 IST (20:30 UTC previous day) gets an attendance record for the *previous* calendar day; the "Present Today" KPI is wrong for the 00:00–05:30 IST window; day boundaries for leave marking drift. `Organization.timezone` exists but is never used.
- **Why it matters**: Incorrect attendance and leave records — core HR data.
- **Fix**: Compute the business calendar day in a configured timezone (`APP_TIMEZONE`, default `Asia/Kolkata`) using `Intl.DateTimeFormat`, and store the canonical key as UTC midnight of that calendar day. Backward compatible with existing production data created on a UTC server (same key for all check-ins between 05:30–23:59 IST). Front-end date-only formatting switched to `timeZone: 'UTC'` so a UTC-midnight date never renders as "yesterday" for users west of UTC.
- **Risk**: Medium (touches date keys). Mitigated by keeping UTC-midnight keys and adding unit tests.

### P0-4 Leave requests can overlap and exceed the annual allowance
- **Path**: `leave.controller.js` (`applyLeave`)
- **Current**: No overlap check — an employee can submit two Pending/Approved requests for the same dates. No balance check — the dashboard computes `remaining = allocated − used` but `applyLeave` never enforces it, so remaining goes negative. Approving two overlapping requests double-counts days.
- **Fix**: Reject if any Pending/Approved request for the same employee overlaps the date range (409). Reject if `days` exceeds remaining for that leave type in the current year, where remaining counts Approved + Pending days (409 with a clear message).
- **Risk**: Low; behaviour is strictly more correct. Documented as a business-rule change.

### P0-5 Non-atomic state transitions (double approval / double check-in / payroll status regressions)
- **Path**: `leave.controller.js` (`resolveLeaveDecision`, `cancelLeave`), `attendance.controller.js` (`checkIn`, `checkOut`), `payroll.controller.js` (`updatePayrollStatus`)
- **Current**: read → check status → save. Two concurrent approvers both pass the `status === 'Pending'` check → duplicate notifications/emails. Two concurrent check-ins both see "no record" → second gets an opaque `employee already exists` 409 from the unique index. `updatePayrollStatus` accepts *any* transition including `Paid → Draft`.
- **Fix**: Conditional `findOneAndUpdate({ _id, status: 'Pending' })` so only one caller wins; upsert-based check-in; forward-only payroll state machine (`Draft → Processed → Paid`) enforced server-side.
- **Risk**: Low.

### P0-6 Production error responses can leak internals; 4xx from body-parser/multer surface as 500
- **Path**: `server/src/middleware/errorHandler.js`
- **Current**: For non-`ApiError` 500s the raw `err.message` (Mongo/Cloudinary/SMTP text) is returned to the client. Malformed JSON bodies (`entity.parse.failed`, status 400) and multer `LIMIT_FILE_SIZE` are reported as 500 and logged as server errors.
- **Fix**: Generic message for unexpected errors in production, honour `err.status`/`err.statusCode` in the 4xx range, map `MulterError` → 400, add a stable `code` field and a `requestId` for support.
- **Risk**: None.

### P0-7 Employee ID generation races; employee creation is not atomic
- **Path**: `utils/generateId.js`, `employee.controller.js` (`createEmployee`, `updateEmployee`)
- **Current**: `countDocuments() + 1` — two concurrent creates collide (unique index throws a confusing 409). `Employee.create` then `User.create`: if the user email already exists (e.g. an admin login with that email), the Employee row is left orphaned without a login. Email change on update can fail on the `User` unique index *after* the Employee was saved.
- **Fix**: Atomic counter collection (`$inc`), initialised from the current max. Pre-check `User` email uniqueness; compensate (delete the Employee) if login provisioning fails. Same pre-check on email change.
- **Risk**: Low.

### P0-8 No validation of query/route parameters; MongoDB operator injection via query strings
- **Path**: `middleware/validate.js` (body-only); every list controller
- **Current**: `?employee[$ne]=…` becomes `{ employee: { $ne: … } }` (Express `qs` parsing). `?page=abc`, `?limit=-5`, invalid status strings, and non-ObjectId ids reach Mongo and surface as CastErrors or silently empty results.
- **Fix**: `validate.query()` and `validate.params()` with Zod schemas per endpoint (pagination, sort whitelist, enums, ObjectIds, dates).
- **Risk**: Low.

### P0-9 Weak password policy + no per-account brute-force protection
- **Path**: `validations/auth.validation.js`, `validations/profile.validation.js`, `middleware/rateLimiter.js`
- **Current**: New passwords need only 6 characters. Only an IP-level limiter (20/15 min) on login; nothing on `/refresh-token`, `/reset-password`; no per-account lockout, so a distributed attacker is unthrottled.
- **Fix**: Strong policy for *new* passwords (≥ 8 chars, letter + number) — login schema unchanged so existing users can still sign in. Per-account lockout after 5 failed attempts (15 min), stored on the `User` document. Rate limit `/reset-password` and `/refresh-token`; global API limiter as a safety net.
- **Risk**: Low.

### P0-10 Production env misconfiguration is not caught at boot
- **Path**: `config/env.js`
- **Current**: In production, a missing `MONGO_URI` silently falls back to `localhost`; JWT secrets are required but not checked for strength; `APP_TIMEZONE` doesn't exist.
- **Fix**: Fail fast in production on missing `MONGO_URI`, on secrets shorter than 32 chars, or identical access/refresh secrets. Add `APP_TIMEZONE` (validated).
- **Risk**: None (only affects misconfigured deployments — which should fail).

---

## P1 — Important

### P1-1 Dashboard makes 27+ sequential queries per load
- **Path**: `dashboard.controller.js` (`getHRDashboard`)
- **Current**: 7-day attendance loop = 21 `countDocuments`; 6-month payroll loop = 6 aggregations; all sequential.
- **Fix**: Two `$group` aggregations over the date/month ranges. Add real KPIs the data supports: payroll status for the current month, new joiners (30d), employment-type mix, joining trend (6 mo), recent activity (audit log). No invented metrics — "late", "WFH" are not tracked and are not shown.

### P1-2 Missing indexes for actual query patterns
- **Path**: models
- `Employee.manager` (every MANAGER request), `Employee.{department,designation,status}`, `Attendance.{date,status}` (dashboard counts across all employees can't use the `(employee,date)` index), `LeaveRequest.{status,createdAt}`, `LeaveRequest.{employee,startDate,endDate}` (overlap check), `Payroll.month`, `Notification.{user,createdAt}` + `{user,isRead}`, `AuditLog.{action,createdAt}`, `Designation.department`, `Approval.{requestType,requestId}`, `RefreshToken.expiresAt` **TTL** (collection currently grows forever).
- `Department` `$text` index only matches whole words → department search for "eng" finds nothing; switched to escaped regex like every other list.

### P1-3 Dropdown data silently truncated at 100
- **Path**: `EmployeeFormPage`, `TeamAttendancePage`, `PayrollManagementPage`, `GeneratePayrollModal` call `employeeApi.list({ limit: 200 })` but `getPagination` clamps to 100 → the manager/employee pickers omit employees past #100 with no warning.
- **Fix**: `GET /api/employees/options` (lean, minimal projection, role-scoped, no pagination).

### P1-4 N+1 and blocking work in payroll generation
- **Path**: `payroll.controller.js` (`generatePayroll`)
- 3 queries + 1 email per employee, sequential. Fix: batch-load existing payroll + salaries with `$in`, `insertMany`, and fire notifications/emails after the response path without blocking each other.

### P1-5 Refresh-cookie / token expiry hardcoded to 7 days regardless of `JWT_REFRESH_EXPIRY`
- **Path**: `utils/cookies.js`, `auth.controller.js` (`issueTokens`)
- Fix: derive both from the signed token's `exp`.

### P1-6 Logging is ad-hoc `console.*`; health-check noise; no auth-failure audit trail
- Fix: tiny structured logger (JSON in production, no new deps), skip `/api/health|ready` in morgan, log failed logins / lockouts / 5xx with request id. Never logs tokens, passwords or secrets.

### P1-7 Frontend has no design system; ~40 copies of the same input class string
- **Path**: every page
- Fix: `Input`, `Select`, `Textarea`, `FormField` (label ↔ input association via `useId`, required marker, inline error with `aria-invalid`), `Card`, `PageHeader`, `IconButton`, `Tabs`, `Skeleton`, `DataTable`, plus Tailwind v4 `@theme` tokens (brand colour, radius, shadows, font).

### P1-8 Tables: no sorting, spinner replaces content (layout shift), unusable on mobile
- Fix: `DataTable` with skeleton rows, sortable columns (server-side `sort` param with whitelist), sticky header, right-aligned numerics, card layout under `md`, built-in empty/error/loading states, page-size selector.

### P1-9 Modal is not accessible
- **Path**: `components/Modal.jsx` — no `role="dialog"`, no focus trap, Escape doesn't close, background scroll not locked, no transition.

### P1-10 Session-expiry UX and stale-response races
- `axiosInstance` logs out silently on refresh failure → user lands on `/login` with no explanation and loses their return URL. List pages don't cancel in-flight requests when filters change → a slow earlier response can overwrite a newer one.
- Fix: `sessionExpired` flag surfaced on the login page; `ProtectedRoute` passes `from`; a small `useApiQuery` hook with `AbortController` + stale-guard used by all list pages; shared `getApiErrorMessage()` mapping network/401/403/404/429/5xx to useful text.

### P1-11 Notification polling continues in background tabs
- Fix: pause when `document.hidden`; unused `notificationsSlice` removed from the store.

### P1-12 Dashboard chunk is 392 KB (recharts) and blocks the first meaningful paint
- Fix: lazy-load chart section separately with a skeleton, so KPI cards render immediately.

### P1-13 Dark-mode flash on load; `<title>` is "client"; no meta description/theme-color
- Fix: apply the theme class synchronously at store init; proper `index.html`.

### P1-14 Seed script is destructive with no production guard
- **Path**: `server/src/seed/seed.js` — `deleteMany({})` on every collection. Fix: refuse to run when `NODE_ENV=production` unless `SEED_ALLOW_DESTRUCTIVE=true`. (Never executed during this work.)

### P1-15 Missing `server/.env.example`; Render blueprint lacks new env var
- Fix: add example file with placeholders; add `APP_TIMEZONE` to `render.yaml`.

### P1-16 Dependency vulnerabilities
- Server: `qs`/`body-parser`/`express`, `brace-expansion`, `morgan` (fixable in-range); `nodemailer` (major), `bcrypt`→`tar` via `node-pre-gyp` (major: bcrypt 6), `exceljs`→`uuid` (no non-breaking fix). Client: `nanoid` (fixable).
- Fix: apply non-breaking `npm audit fix` on both; document the majors as follow-ups (bcrypt 6 needs a rebuild test on Render; nodemailer 10 API review).

### P1-17 Validation gaps in bodies
- No max lengths (names, reason, comment, description); dates accepted as any string; `workingDays` accepts arbitrary strings; `timezone` unvalidated; `manager` may equal self; department/designation existence and designation↔department consistency unchecked.

### P1-18 Payroll float rounding
- `basic + hra + allowances − deductions` with decimals can yield `72000.00000001`. Fix: round to 2 dp in the pure calculation helpers.

---

## P2 — Enhancements

- Sidebar: group navigation into sections, persist collapsed state, tooltips when collapsed, user menu with role badge, active-route indicator.
- Page transitions / modal / dropdown / toast animations (fast, `prefers-reduced-motion` respected).
- Toasts with `aria-live`, info/warning variants, and a progress-free 4s auto-dismiss with hover pause.
- `StatusBadge` with a leading dot (status is not conveyed by colour alone; text always present).
- Employee detail: tabs keyboard-navigable, Payroll/Attendance/Leave tabs reuse `DataTable`.
- Attendance page: live "hours so far" since check-in.
- Pagination shows totals even on a single page; page size selector.
- Centralised `utils/format.js` (currency via `VITE_CURRENCY`, dates, times, relative time).
- Employee count trend and department distribution rendered as horizontal bars (readable with many departments) instead of labelled pie slices.
- Login page split layout with product messaging (no fake statistics).

---

## Business-logic review notes (documented, not all changed)

| Area | Observation | Action |
|---|---|---|
| Attendance | Full day = 8h, else HalfDay; no late/overtime/shift concept | Kept as designed (no "late"/"WFH" KPIs invented) |
| Attendance | Check-in on an approved-leave day flips status to Present | Kept (employee actually came in); noted |
| Leave | Day count is calendar-inclusive (weekends/holidays not excluded) — documented "simplified" scope | Kept; org `workingDays` is stored but not applied (roadmap) |
| Leave | Balance year = calendar year from `startDate` | Kept; now enforced at apply time |
| Leave | Cancelling sets the Approval to `Rejected` (enum has no `Cancelled`) | Kept; noted |
| Payroll | Fixed monthly structure, attendance does not affect pay; generation for future months and for employees who joined after the month is allowed | Kept; noted as roadmap (pro-rata) |
| Payroll | Draft records hidden from employees | Kept |
| Approvals | Direct manager or any HR/SUPER_ADMIN; `Approval.refPath` points at enum value `LEAVE`, which is not a model name (populate would fail; unused) | Kept; noted |
| Auth | Refresh rotation, revocation on password reset ✔; no reuse-detection (token family revoke) | Roadmap |

---

## Production readiness checklist (after fixes)

- [x] Secrets only via env; `.env` ignored; `.env.example` present; no secrets in repo docs
- [x] Fail-fast env validation in production (Mongo URI, JWT secrets, timezone)
- [x] CORS allow-list with credentials; Helmet; JSON body limit; rate limits (auth + global)
- [x] `/api/health` (liveness) and `/api/ready` (Mongo readiness) — Render blueprint uses `/api/ready`
- [x] Graceful shutdown on SIGTERM/SIGINT; unhandled rejection/exception handlers; Mongo reconnect logging
- [x] Central error handler: no stack traces/internal messages in production, stable `code`, `requestId`
- [x] Structured logs in production; auth failures logged; no secrets/tokens logged
- [x] Indexes declared for real query patterns; TTL for refresh tokens
- [x] Tests: unit (dates/tz, regex escape, sort, password policy, payroll rounding) + integration (leave overlap/balance, payroll transitions, attendance atomicity, employee field scoping, lockout)
