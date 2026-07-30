# API Test Report

Base URL: `http://localhost:5000/api`. All responses follow `{ success, message, data, pagination? }`.
Testing method: live HTTP requests against a running instance (backend on Node 22, MongoDB 8.3 local, Redis disabled, Cloudinary unset, email disabled) with seeded demo data, plus the existing Jest/Supertest integration suite. Test status reflects what was actually exercised in this pass, not assumed from reading code.

Legend: **Tested** = verified live via HTTP in this session · **Covered by Jest** = exercised by `server/tests/integration/*.test.js` · **Not independently tested** = reviewed via code but not separately exercised (e.g. requires Cloudinary/Redis/SMTP credentials not available in this environment)

## Auth — `/api/auth`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| POST | /login | No (rate-limited 20/15min) | — | auth.controller.login | Tested |
| POST | /refresh-token | Cookie (refreshToken) | — | auth.controller.refreshTokenHandler | Tested |
| POST | /logout | Cookie (optional) | — | auth.controller.logout | Tested |
| GET | /me | Bearer | any | auth.controller.me | Tested |
| POST | /forgot-password | No (rate-limited) | — | auth.controller.forgotPassword | Tested (generic response); real email delivery not tested (EMAIL_ENABLED=false) |
| POST | /reset-password | No | — | auth.controller.resetPassword | Covered by Jest |

## Organization — `/api/organization`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | / | Bearer | any | organization.controller.getOrganization | Tested |
| PUT | / | Bearer | HR_ADMIN, SUPER_ADMIN | organization.controller.updateOrganization | Tested |
| POST | /logo | Bearer, multipart | HR_ADMIN, SUPER_ADMIN | organization.controller.uploadLogo | Tested (multipart parsing verified; actual Cloudinary storage not tested — no credentials in this env) |

## Departments — `/api/departments`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | / | Bearer | any | department.controller.listDepartments | Tested |
| GET | /:id | Bearer | any | department.controller.getDepartment | Tested |
| POST | / | Bearer | HR_ADMIN, SUPER_ADMIN | department.controller.createDepartment | Tested |
| PUT | /:id | Bearer | HR_ADMIN, SUPER_ADMIN | department.controller.updateDepartment | Tested |
| DELETE | /:id | Bearer | HR_ADMIN, SUPER_ADMIN | department.controller.deleteDepartment | Tested (incl. delete-guard) |

## Designations — `/api/designations`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | / | Bearer | any | designation.controller.listDesignations | Tested |
| GET | /:id | Bearer | any | designation.controller.getDesignation | Tested |
| POST | / | Bearer | HR_ADMIN, SUPER_ADMIN | designation.controller.createDesignation | Tested |
| PUT | /:id | Bearer | HR_ADMIN, SUPER_ADMIN | designation.controller.updateDesignation | Tested |
| DELETE | /:id | Bearer | HR_ADMIN, SUPER_ADMIN | designation.controller.deleteDesignation | Not independently tested (same delete-guard pattern as departments, verified via code) |

## Employees — `/api/employees`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | / | Bearer | any (MANAGER scoped to team) | employee.controller.listEmployees | Tested |
| GET | /search | Bearer | any (MANAGER scoped) | employee.controller.quickSearch | Tested |
| GET | /:id | Bearer | any (MANAGER scoped) | employee.controller.getEmployee | Tested |
| POST | / | Bearer | HR_ADMIN, SUPER_ADMIN | employee.controller.createEmployee | Tested |
| PUT | /:id | Bearer | HR_ADMIN, SUPER_ADMIN | employee.controller.updateEmployee | Covered by Jest |
| PATCH | /:id/status | Bearer | HR_ADMIN, SUPER_ADMIN | employee.controller.updateEmployeeStatus | Tested |
| POST | /:id/profile-image | Bearer, multipart | self or HR/Admin | employee.controller.uploadProfileImage | Tested (multipart parsing; BUG-003 fix verified) |

## Attendance — `/api/attendance`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| POST | /check-in | Bearer | any w/ employee profile | attendance.controller.checkIn | Tested (incl. double check-in 409) |
| POST | /check-out | Bearer | any w/ employee profile | attendance.controller.checkOut | Tested (incl. no check-in 400, double check-out 409) |
| GET | /me/today | Bearer | any w/ employee profile | attendance.controller.getTodayAttendance | Tested |
| GET | /me/history | Bearer | any w/ employee profile | attendance.controller.getMyHistory | Tested |
| GET | / | Bearer | HR_ADMIN, SUPER_ADMIN, MANAGER (scoped) | attendance.controller.listAttendance | Tested (incl. manager scope-bypass attempt) |

## Leaves — `/api/leaves`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | /leave-types | Bearer | any | leave.controller.listLeaveTypes | Tested |
| POST | /apply | Bearer | any w/ employee profile | leave.controller.applyLeave | Tested (incl. bad dates, missing reason, invalid type) |
| GET | /me | Bearer | any w/ employee profile | leave.controller.getMyLeaves | Tested |
| PATCH | /:id/cancel | Bearer | own request only | leave.controller.cancelLeave | Tested (incl. re-cancel, cancel-approved 409) |
| GET | / | Bearer | HR_ADMIN, SUPER_ADMIN, MANAGER (scoped) | leave.controller.listLeaveRequests | Tested (incl. scope-bypass attempt) |
| PATCH | /:id/approve | Bearer | direct manager or HR/Admin | leave.controller.approveLeave | Tested (self-approve, unrelated-manager, re-approve all correctly rejected) |
| PATCH | /:id/reject | Bearer | direct manager or HR/Admin | leave.controller.rejectLeave | Tested |

## Payroll — `/api/payroll`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | /me | Bearer | any w/ employee profile | payroll.controller.getMyPayroll | Tested |
| GET | /salary/:employeeId | Bearer | self or HR/Admin | payroll.controller.getSalary | Tested |
| PUT | /salary/:employeeId | Bearer | HR_ADMIN, SUPER_ADMIN | payroll.controller.updateSalary | Tested (incl. negative-value rejection) |
| POST | /generate | Bearer | HR_ADMIN, SUPER_ADMIN | payroll.controller.generatePayroll | Tested (incl. duplicate-month skip) |
| GET | / | Bearer | HR_ADMIN, SUPER_ADMIN | payroll.controller.listPayroll | Tested |
| PATCH | /:id/status | Bearer | HR_ADMIN, SUPER_ADMIN | payroll.controller.updatePayrollStatus | Tested |

## Dashboard — `/api/dashboard`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | /hr | Bearer | HR_ADMIN, SUPER_ADMIN | dashboard.controller.getHRDashboard | Tested |
| GET | /manager | Bearer | MANAGER, HR_ADMIN, SUPER_ADMIN | dashboard.controller.getManagerDashboard | Tested |
| GET | /employee | Bearer | any w/ employee profile | dashboard.controller.getEmployeeDashboard | Tested (incl. SUPER_ADMIN-with-no-profile 403) |

## Notifications — `/api/notifications`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | / | Bearer | any | notification.controller.listNotifications | Tested |
| PATCH | /:id/read | Bearer | own notification only | notification.controller.markAsRead | Tested (incl. cross-user 404) |
| PATCH | /read-all | Bearer | any | notification.controller.markAllAsRead | Tested |

## Audit Logs — `/api/audit-logs`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | / | Bearer | HR_ADMIN, SUPER_ADMIN | auditLog.controller.listAuditLogs | Tested |
| GET | /actions | Bearer | HR_ADMIN, SUPER_ADMIN | auditLog.controller.listDistinctActions | Tested |

## Profile — `/api/profile`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | /me | Bearer | any | profile.controller.getMyProfile | Tested |
| PUT | /me | Bearer | any | profile.controller.updateMyProfile | Tested (incl. privilege-escalation attempt via extra `role` field — ignored server-side) |
| PUT | /me/password | Bearer | any | profile.controller.changeMyPassword | Tested (incl. wrong-current-password 400) |
| POST | /me/avatar | Bearer, multipart | any w/ employee profile | profile.controller.uploadMyAvatar | Not independently re-tested (identical code path to BUG-003, fixed and verified via employee/org uploads) |

## Export — `/api/export`

| Method | Endpoint | Auth | Roles | Controller | Test status |
|---|---|---|---|---|---|
| GET | /employees.xlsx | Bearer | HR_ADMIN, SUPER_ADMIN | export.controller.exportEmployees | Tested (content-type + 403 for EMPLOYEE) |
| GET | /attendance.xlsx | Bearer | HR_ADMIN, SUPER_ADMIN | export.controller.exportAttendance | Not independently tested (identical pattern) |
| GET | /leaves.xlsx | Bearer | HR_ADMIN, SUPER_ADMIN | export.controller.exportLeaves | Not independently tested (identical pattern) |
| GET | /payroll.xlsx | Bearer | HR_ADMIN, SUPER_ADMIN | export.controller.exportPayroll | Not independently tested (identical pattern) |

## Misc

| Method | Endpoint | Auth | Test status |
|---|---|---|---|
| GET | /health | No | Tested |

## Validation / error-handling checks (cross-cutting)

- Malformed request bodies → `422` with a readable `errors: string[]` array (not raw Zod internals). **Tested.**
- Invalid MongoDB ObjectId in a route param → `400 Invalid <field>: <value>` (Mongoose CastError translated), not a raw stack or 500. **Tested.**
- Nonexistent-but-valid ObjectId → `404`. **Tested.**
- Duplicate unique field (department code) → `409` with a clean message, not a raw Mongo 11000 dump. **Tested.**
- Pagination: negative page clamps to 1, huge limit clamps to server max (100), non-numeric page/limit falls back to defaults, page beyond total returns an empty array (not an error), special characters in search don't crash the query. **All tested.**
- Centralized error handler never leaks stack traces outside `NODE_ENV=development`, and never returns HTML to the frontend (`server/src/middleware/errorHandler.js`, `notFoundHandler`). **Verified via code + observed responses.**

## Known gaps in this pass

- **Redis-enabled path**: no Redis instance was available in this environment (not installed, no service running). The no-op/disabled path (`REDIS_ENABLED=false`, the project default) was fully tested; the enabled cache-aside path was verified by code review only (every mutating endpoint that affects the HR dashboard or organization cache correctly calls `.del()` on the relevant key — see `dashboard.controller.js`, `organization.controller.js`, `employee.controller.js`, `leave.controller.js`, `payroll.controller.js`).
- **Cloudinary uploads**: no Cloudinary credentials configured in this environment. Confirmed the app degrades correctly (clean `503`, not a crash) and — critically — confirmed multer/busboy now correctly *parses* the uploaded file after BUG-003's fix (proven by reaching the Cloudinary-not-configured 503 rather than a "no file uploaded" 400). Actual image storage/CDN URL was not exercised.
- **Real SMTP delivery**: not tested (EMAIL_ENABLED=false is the project default); the console-log fallback path was observed directly in server output during the employee-creation and leave-workflow tests.
- **UI/browser testing**: no browser automation was available in this session (the user declined the browser-extension install prompt mid-session). All frontend correctness claims in this report and TEST_REPORT.md are based on (a) static analysis of the React source cross-referenced against actual backend responses, and (b) `oxlint` + `vite build` passing cleanly — **not** on driving the rendered UI in a real browser. This is called out explicitly rather than claimed as verified.
