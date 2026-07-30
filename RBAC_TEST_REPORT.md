# RBAC Test Report

All checks below were run as direct HTTP requests against the backend (not inferred from hidden sidebar items), logging in as real seeded accounts of each role. `requireRole()` (`server/src/middleware/rbac.js`) enforces the allow-list server-side on every route below; several endpoints additionally scope query results *within* an allowed role (e.g. a MANAGER is allowed to call `GET /attendance`, but the controller silently restricts the result set to their own team, and rejects an explicit `?employee=` filter that points outside their team).

Roles: `SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`.

## RBAC matrix (as implemented and verified)

| Action | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | Verified |
|---|:---:|:---:|:---:|:---:|---|
| Manage Organization (`PUT /organization`) | ✅ | ✅ | 403 | 403 | Yes (EMPLOYEE, MANAGER denial tested) |
| Departments/Designations CRUD | ✅ | ✅ | view only | view only | Yes |
| Employees CRUD | ✅ | ✅ | view team only | view self only | Yes |
| Attendance check-in/out | ✅ | ✅ | ✅ | ✅ | Yes |
| View all attendance (`GET /attendance`) | ✅ | ✅ | team only (server-enforced) | 403 | Yes |
| Apply leave | ✅ | ✅ | ✅ | ✅ | Yes |
| Approve/reject leave | ✅ | ✅ (fallback for no-manager employees) | direct reports only | 403 | Yes |
| Configure salary / generate payroll | ✅ | ✅ | 403 | 403 | Yes |
| View own payroll (`GET /payroll/me`) | ✅ | ✅ | ✅ | ✅ | Yes |
| View another employee's salary | 403 (own only unless HR) | ✅ | 403 | 403 | Yes |
| Audit logs / Excel export | ✅ | ✅ | 403 | 403 | Yes |

## Direct backend authorization tests (not inferred from UI)

| # | Actor | Request | Expected | Actual | Result |
|---|---|---|---|---|---|
| RBAC-001 | EMPLOYEE | `POST /employees` | 403 | 403 | PASS |
| RBAC-002 | EMPLOYEE | `DELETE /departments/:id` | 403 | 403 | PASS |
| RBAC-003 | EMPLOYEE | `POST /departments` | 403 | 403 | PASS |
| RBAC-004 | EMPLOYEE | `POST /designations` | 403 | 403 | PASS |
| RBAC-005 | EMPLOYEE | `POST /payroll/generate` | 403 | 403 | PASS |
| RBAC-006 | EMPLOYEE | `GET /audit-logs` | 403 | 403 | PASS |
| RBAC-007 | EMPLOYEE | `GET /export/employees.xlsx` | 403 | 403 | PASS |
| RBAC-008 | EMPLOYEE | `GET /attendance` (team view) | 403 | 403 | PASS |
| RBAC-009 | EMPLOYEE | `GET /leaves` (approvals list) | 403 | 403 | PASS |
| RBAC-010 | EMPLOYEE | `PUT /organization` | 403 | 403 | PASS |
| RBAC-011 | MANAGER | `POST /employees` | 403 | 403 | PASS |
| RBAC-012 | MANAGER | `POST /payroll/generate` | 403 | 403 | PASS |
| RBAC-013 | MANAGER | `GET /audit-logs` | 403 | 403 | PASS |
| RBAC-014 | MANAGER | `PUT /organization` | 403 | 403 | PASS |
| RBAC-015 | MANAGER | `GET /attendance` (own team) | 200 | 200 | PASS |
| RBAC-016 | MANAGER | `GET /leaves` (own team) | 200 | 200 | PASS |
| RBAC-017 | HR_ADMIN | `GET /audit-logs` | 200 | 200 | PASS |
| RBAC-018 | HR_ADMIN | `GET /export/employees.xlsx` | 200 | 200 | PASS |
| RBAC-019 | MANAGER (Engineering) | `GET /attendance?employee=<Sales-team-member-id>` | 403 (query-level scope enforced server-side, not just hidden in the UI) | 403 | PASS |
| RBAC-020 | MANAGER (Engineering) | `GET /leaves?employee=<Sales-team-member-id>` | 403 | 403 | PASS |
| RBAC-021 | EMPLOYEE | `GET /payroll/salary/<another-employee-id>` | 403 | 403 | PASS |
| LEAVE-005 | EMPLOYEE | `PATCH /leaves/:id/approve` on **own** request | 403 | 403 | PASS |
| LEAVE-006 | MANAGER (Sales) | `PATCH /leaves/:id/approve` on an **Engineering** report's request | 403 | 403 | PASS |
| LEAVE-016 | MANAGER (Engineering) | `PATCH /leaves/:id/approve` on a **no-manager employee's** request | 403 | 403 | PASS |
| LEAVE-017 | HR_ADMIN | `PATCH /leaves/:id/approve` on a **no-manager employee's** request (fallback approver) | 200 | 200 | PASS |
| PROF-002 | EMPLOYEE | `PUT /profile/me` with an injected `role: "SUPER_ADMIN"` field | Ignored — schema only touches phone/dob/address | Ignored, role unchanged | PASS |
| NOTIF-004 | EMPLOYEE | `PATCH /notifications/:id/read` for **another user's** notification | 404 (existence not leaked) | 404 | PASS |
| DASH-004 | SUPER_ADMIN (no linked Employee record) | `GET /dashboard/employee` | 403, not 500 | 403 | PASS |

## Server-side query scoping (the important part — not just hidden UI)

The RBAC-019/020 tests specifically targeted the pattern called out in the project's own README as "a real bug caught and fixed during Phase 8/9": a MANAGER passing an explicit `?employee=<id>` query parameter for someone **outside** their team. Both `attendance.controller.listAttendance` and `leave.controller.listLeaveRequests` independently compute the manager's team (`Employee.find({ manager: req.user.employee._id })`) and reject the request with 403 if the requested `employee` id isn't in that set, rather than silently ignoring the filter or trusting it. Verified working correctly in this pass.

## Result

**21/21 direct RBAC boundary tests passed.** No privilege-escalation or scope-bypass was found in this pass.
