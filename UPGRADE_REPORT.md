# Enterprise HRMS — Upgrade Report

Date: 2026-09-12. Companion to [AUDIT_REPORT.md](AUDIT_REPORT.md) (the prioritized findings this work implements).

## 1. What was found (most important)

| # | Finding | Severity |
|---|---|---|
| 1 | Any authenticated user could read any employee's full record (DOB, home address, phone, manager) via `GET /api/employees` and `/:id` | P0 |
| 2 | User input compiled straight into `RegExp` in five list/search/export endpoints (ReDoS / regex injection) | P0 |
| 3 | Attendance/leave "today" computed in the *server's* timezone (UTC on Render) — a 02:00 IST check-in landed on the previous day; `Organization.timezone` was never used | P0 |
| 4 | Leave requests could overlap and exceed the annual allowance; nothing enforced the balance the dashboard displayed | P0 |
| 5 | Non-atomic state transitions: double approvals, double check-ins (opaque 409), payroll `Paid → Draft` allowed | P0 |
| 6 | Production 500s returned raw driver messages; malformed JSON and oversized uploads surfaced as 500 | P0 |
| 7 | Employee-ID generation raced (`countDocuments()+1`); employee creation left orphans when login provisioning failed | P0 |
| 8 | No validation of query/route params → `?employee[$ne]=…` operator injection, CastErrors, silent empty results | P0 |
| 9 | 6-character passwords, no per-account lockout, `/reset-password` & `/refresh-token` unthrottled | P0 |
| 10 | Production could boot with `MONGO_URI` unset (localhost fallback) or 8-char JWT secrets | P0 |
| 11 | HR dashboard ran 27+ sequential queries; missing indexes for every manager-scoped and date-scoped query; refresh-token table grew forever | P1 |
| 12 | Dropdowns silently truncated at 100 employees (`limit:200` clamped to 100) | P1 |
| 13 | Frontend: no design system (≈40 copies of one input class string), no table sorting, spinner-only loading, tables unusable on phones, inaccessible modal, silent session expiry, stale-response races, dark-mode flash, `<title>client</title>` | P1 |

## 2. What changed

### Server (`server/`)
- **New**: `src/utils/logger.js`, `src/utils/regex.js`, `src/middleware/requestId.js`, `src/validations/common.js`, `src/validations/{attendance,auditLog,notification}.validation.js`, `src/models/Counter.js`, `.env.example`, tests `tests/unit/dateHelpers.test.js`, `tests/unit/helpers.test.js`, `tests/integration/businessRules.test.js`.
- **Rewritten**: `config/env.js`, `config/db.js`, `utils/dateHelpers.js`, `utils/ApiError.js`, `utils/apiResponse.js`, `utils/pagination.js`, `utils/generateId.js`, `utils/payrollCalculations.js`, `utils/cookies.js`, `middleware/{errorHandler,validate,rateLimiter,auth}.js`, controllers for auth / employee / attendance / leave / payroll / dashboard, every route file, `app.js`, `server.js`, every validation schema.
- **Patched**: department / designation / auditLog / notification / export / organization / profile controllers, all models (indexes, lockout fields, TTL), `seed/seed.js` (production guard + shared day keys), `services/*` (structured logging), `package.json` (nodemailer 10, `qs` override, `engines`).

### Client (`client/`)
- **New design system** `src/components/ui/` (23 components: Button, IconButton, Input, Select, Textarea, FormField, SearchInput, Card, PageHeader, Tabs, DataTable, Pagination, Modal, ConfirmDialog, Dropdown, StatusBadge/Badge, Avatar, StatCard, ProgressBar, Tooltip, Toolbar, StateViews, Skeleton set) + `index.css` tokens.
- **New hooks/utils**: `hooks/useApiQuery.js`, `hooks/useListParams.js`, `utils/format.js`, `utils/apiError.js`, `utils/validation.js`, `components/PasswordStrength.jsx`, `pages/dashboard/chartTheme.js`, `pages/dashboard/HRDashboardCharts.jsx` (lazy chunk).
- **Rewritten**: every page (20), both layouts, `AppRoutes`, `ProtectedRoute`, `axiosInstance`, `authSlice`, `themeSlice`, `store`, all `api/*` modules, `NotificationBell`, `GlobalSearch`, `ToastProvider`, `index.html`.
- **Removed**: superseded top-level components, unused `notificationsSlice`.

### Config / docs
- `render.yaml` (+`APP_TIMEZONE`, `LOG_LEVEL`), `client/vercel.json` + `client/nginx.conf` (security headers), `client/.env.example`, `README.md` env docs, `AUDIT_REPORT.md`, this file.

## 3. UI / UX improvements
- Enterprise-style shell: grouped sidebar (Overview / People / Time & Leave / Payroll / Administration), persisted collapse, account menu, ⌘K search, mobile drawer with backdrop, skip-link, dark mode applied before first paint.
- **DataTable** everywhere: skeleton rows → subtle refetch bar (no layout shift), sortable headers (server-side, whitelisted), right-aligned numerics, sticky header, row actions with accessible names, empty/error/no-results states with retry/clear, page-size selector, and a stacked card layout under `md` so phones never scroll horizontally.
- Dashboards rebuilt on real data only: HR (6 KPIs, payroll status card with progress, leave overview with utilization table, workforce mix, 7-day stacked attendance, department bars, payroll trend, joining trend, recent activity feed), Manager (team-today table, upcoming leaves), Employee (greeting, check-in/out from the dashboard, avg hours, leave balances with progress bars, next leave). Chart palette validated for CVD/contrast in both themes; recharts loads as a separate chunk after KPIs paint.
- Forms: labelled/`aria-describedby` fields via `FormField`, required markers, inline + server-mapped errors, password strength meter, disabled-until-dirty saves, `loading` buttons that block double-submit, sticky action bar on the long employee form, live day-count/balance warning in the leave modal, gross/net preview in the salary modal.
- Accessible Modal (dialog role, focus trap, Esc, scroll lock, focus return, mobile bottom-sheet), Tabs with arrow-key navigation, Dropdown menus, `aria-live` toasts with titles and hover-pause, StatusBadge with dot + text (never colour alone), `prefers-reduced-motion` honoured.
- Session expiry explained on the login page; return-to-URL after login; error messages mapped from status/network conditions ("Unable to reach the server…", "Your session has expired…").

## 4. Backend improvements
- Response envelope now carries a stable `code` on errors plus `requestId` (also in `X-Request-Id`); `meta` supported on success (payroll totals). No internal messages/stack traces in production.
- Validation of body **and** query **and** params on every list/detail/mutation route (ObjectIds, dates, enums, pagination, sort whitelist, max lengths, timezone, weekday enums, money precision).
- Auth: per-account lockout (5 failures → 15 min, configurable), constant-time unknown-email path, `TOKEN_EXPIRED` vs `TOKEN_INVALID` codes, cookie/DB expiry derived from `JWT_REFRESH_EXPIRY`, cookie cleared on invalid refresh, other sessions revoked on password change and on deactivation, strong policy for new passwords only.
- Authorization: role-based projection for employee data; managers cannot approve their own leave; self-deactivation blocked.
- Rate limits: auth 20/15m, refresh 60/15m, global 1500/15m per IP (skipped under test).
- Atomic operations: check-in upsert, conditional check-out, conditional leave approve/reject/cancel, forward-only payroll transitions, `$inc` counter for employee IDs, `insertMany`/batch loads for payroll generation, `bulkWrite` for leave→attendance marking.
- Structured JSON logging in production (auth failures, lockouts, 5xx with request id, Mongo connection events); health probes excluded from access logs; `unhandledRejection`/`uncaughtException` handlers; export row cap (10k).
- New endpoints: `GET /employees/options`, `GET /leaves/me/balance`, `GET /payroll/salaries`; `sort`, `from/to`, `employmentType`, `entityType`, `unreadOnly` filters.

## 5. Database improvements
- Indexes added for real query patterns: `Employee {manager,status} {department,status} {designation} {status,firstName,lastName} {joiningDate}`, `Attendance {date,status}`, `LeaveRequest {status,createdAt} {employee,startDate,endDate}`, `Payroll {month,status}`, `Notification {user,createdAt} {user,isRead}`, `AuditLog {action,createdAt}`, `Designation {department,status}`, `Approval {requestType,requestId} {approver,status}`, **TTL** on `RefreshToken.expiresAt`.
- Day keys standardised to UTC midnight of the business calendar day (backward compatible with rows written on a UTC server).
- HR dashboard: 27+ sequential queries → 15 parallel queries (two `$group` aggregations replace the 7-day and 6-month loops). `.lean()` on all read-only list queries. Department search uses an escaped regex (the `$text` whole-word index was removed from the schema; drop the leftover index in Atlas if present).
- `Counter` collection for atomic ids; `User.failedLoginAttempts/lockUntil`.

## 6. Bugs fixed
1. Personal data exposure to colleagues (IDOR-style over-exposure).
2. Regex injection / ReDoS in search, filters and exports.
3. Wrong attendance/leave day near midnight for non-UTC organizations; date-only values rendering as the previous day for viewers west of UTC.
4. Overlapping leave requests and negative leave balances.
5. Double approval / double check-in / payroll status regression races.
6. Manager could approve their own leave request.
7. Duplicate-key collisions in employee-ID generation; orphaned Employee rows when login provisioning failed; email change breaking the linked login.
8. Malformed JSON / oversized upload reported as 500; internal error text leaked in production.
9. Cookie and DB refresh-token expiry hard-coded to 7 days regardless of `JWT_REFRESH_EXPIRY`.
10. Manager / employee dropdowns silently truncated at 100 records.
11. Department search matching only whole words.
12. Designation select showing blank in edit mode after the options loaded.
13. Notification polling continuing in background tabs.
14. Stale list responses overwriting newer ones when filters changed quickly.
15. Dark-mode flash on load; missing return-to-URL after login; silent logout on session expiry.
16. Floating-point drift in payroll gross/net.
17. Seed script producing attendance keys that the API could not find on non-UTC machines; seed runnable against production.

## 7. Tests performed

```
server:  npm run lint   → clean
         npx jest       → Test Suites: 16 passed, Tests: 111 passed (was 74)
client:  npm run lint   → clean (oxlint)
         npm run build  → ✓ built; first-paint dashboard chunk 392 KB → 22 KB (charts lazy, 367 KB)
npm audit fix (non-breaking) applied on both packages; nodemailer 6 → 10.0.8; qs overridden to 6.16.0
env guards: verified fail-fast for missing/short/identical secrets and invalid APP_TIMEZONE
smoke:   API + seeded demo data on an in-memory MongoDB (never Atlas) at :5055, client preview at :4173;
         driven headlessly with Playwright — HR/Manager/Employee flows, dark mode, 400 px mobile — 0 page errors;
         verified: query-operator injection → 422, sort whitelist → 422, directory view for colleagues,
         payroll totals meta, request-id header, dashboards populated from seeded data
```

New tests cover: timezone day keys, regex escaping, sort whitelist, payroll rounding, password policy, date/ObjectId/organization schemas, leave overlap + balance + self-approval + double decision, concurrent check-in atomicity, check-out single-use, query injection, payroll state machine + salary listing, employee field scoping (colleague/self/manager/HR), concurrent id generation, self-manager rejection, manager-scoped options, login lockout, malformed JSON envelope, invalid route id.

## 8. Remaining issues (honest)
- **Dependencies needing major bumps**: `bcrypt 5 → 6` (clears the `tar`/`node-pre-gyp` install-time advisories; verify the native build on Render first) and `exceljs` (its `uuid` advisory concerns v3/v5/v6 generation, which exceljs does not use).
- Leave day counting is calendar-inclusive; `Organization.workingDays` is stored but not applied to leave/attendance (documented scope, roadmap).
- Payroll is a fixed monthly structure — no pro-rata for joiners, unpaid leave or attendance effects.
- No refresh-token reuse detection (revoke the whole family when a revoked token is presented).
- Rate limiting is per-process memory; on multiple Render instances use a shared store.
- The client build is validated by lint/build/headless smoke; there are no frontend unit tests yet.
- Mongoose builds the new indexes on first boot (`autoIndex`); on a very large Atlas collection prefer creating them in the background beforehand.
- `Approval.refPath` still points at the enum value `LEAVE` (not a model name); unused by any populate today.

## 9. Recommended next steps
1. **Apply org working days & holidays** to leave day counts and the attendance "absent" calculation (the `Organization` fields already exist) — this is the largest remaining correctness gap in HR terms.
2. **Pro-rata payroll** (joining date, unpaid leave) and a payslip PDF/download from the employee payroll page.
3. **Frontend test layer**: Vitest + Testing Library for `DataTable`, `Modal`, `useApiQuery`, and the leave/approval flows; add to CI.
4. **Refresh-token family revocation + device/session list** on the profile page ("sign out everywhere").
5. **Upgrade `bcrypt` to 6 and add a Redis store for `express-rate-limit`** once Render runs more than one instance; add Sentry-style error reporting keyed by `requestId`.
