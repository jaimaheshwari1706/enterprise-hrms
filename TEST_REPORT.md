# Enterprise HRMS — Test Report

## Project status

The application was audited, debugged, and polished in place — no rebuild, no removed features, no mocked data. **5 real bugs were found and fixed** (see `BUGS.md` for full root-cause detail). The critical reported symptom — *"login works → dashboard → refresh → logged out"* — is fixed and verified at the HTTP level. The backend test suite (74 tests) and frontend production build both pass cleanly.

**Environment tested:** Node 22.23.1, MongoDB 8.3 (local), Windows 11. Redis disabled (project default), Cloudinary unset (project default — uploads degrade to a clean 503), email disabled (project default — logs to console). No browser automation was available in this session (see caveat below) — API/contract testing was done via direct HTTP requests and static analysis of the React source against actual backend responses, not by driving the rendered UI.

**Important caveat on frontend claims:** Per the instructions for this task, frontend correctness below is reported honestly: PASS means "verified either by a live HTTP contract test or by static code inspection cross-referenced against the actual running backend"; it does **not** mean "clicked through in a browser." Where a claim rests only on code review, it's marked accordingly. The one browser-only category of bug that *was* still found (BUG-004, a missing import causing a guaranteed runtime crash) was caught mechanically via `oxlint`, not by reading the file — a reminder that static review alone would have missed it too.

## Modules tested

Auth/session lifecycle, RBAC (4 roles), Employee CRUD, Organization, Departments, Designations, Attendance, Leave + approval workflow, Payroll, Dashboards (HR/Manager/Employee), Notifications, Audit Logs, Profile, Search/Filter/Pagination, File uploads, Excel export, Redis cache-aside (code-level), Email (disabled-path), error handling, form validation, ESLint/oxlint, production build, existing automated tests.

## APIs tested

61 backend endpoints inventoried across 13 resource groups; see `API_TEST_REPORT.md` for the full per-endpoint table. The large majority were exercised live via HTTP (success, validation, auth, authz, and not-found cases); a handful of structurally-identical endpoints (e.g. the 3 other Excel export routes, which share one code path with the one that was tested) were verified by code review rather than re-run individually.

## Bugs discovered and fixed

| ID | Area | Severity | Summary | Status |
|---|---|---|---|---|
| BUG-001 | Auth — refresh-token rotation | CRITICAL | React StrictMode double-fired the session-bootstrap request; the backend's non-atomic token rotation let both concurrent requests race, so a legitimate session was sometimes logged out on refresh. This is **the reported bug**. | VERIFIED |
| BUG-002 | Backend test tooling | MEDIUM | `npm test` failed outright (stale `node_modules`) and then failed under load (5 parallel in-memory Mongo instances exceeding a 10s startup timeout on this machine). | VERIFIED |
| BUG-003 | File uploads (3 features) | CRITICAL | Employee photo, org logo, and profile avatar uploads all sent a malformed `multipart/form-data` header (no boundary), which crashes multer/busboy server-side — every image upload feature in the app was broken. | VERIFIED |
| BUG-004 | Employee Detail page | HIGH | `EmptyState` used in 4 places but never imported → guaranteed `ReferenceError` crash for any employee with zero attendance/leave/payroll records (i.e. every new hire). | VERIFIED |
| BUG-005 | Backend ESLint config | MEDIUM | `npm run lint` had never actually run (no config file existed) — which is how BUG-004 went unnoticed. | VERIFIED |

Full root-cause writeups, fixes, and verification steps for each are in `BUGS.md`.

## Remaining/known issues (not bugs, documented for transparency)

- Frontend production bundle is a single ~934KB chunk (no route-based code-splitting). Vite warns about this; it's a performance optimization opportunity, not a defect, and was left as-is per the instruction not to refactor beyond what's needed to fix bugs.
- Two pre-existing `no-unused-vars` warnings in test files (`leaveApproval.test.js`, `employeeAndPayrollValidation.test.js`) — harmless, unrelated to application behavior.
- Redis-enabled path, real Cloudinary storage, and real SMTP delivery were not live-tested (no credentials/services available in this environment) — verified by code review only. See "Known gaps" in `API_TEST_REPORT.md`.

## Authentication results

All 20 requested AUTH-* scenarios plus a dedicated BUG-001 regression test were run directly against the backend (bypassing the browser, since it's the most reliable way to control request timing/concurrency precisely):

| ID | Scenario | Result |
|---|---|---|
| AUTH-001 | Valid login | PASS |
| AUTH-002 | Invalid password → 401 | PASS |
| AUTH-003 | Unknown email → 401 (no enumeration) | PASS |
| AUTH-004 | Protected route without auth → 401 | PASS |
| AUTH-005 | **Login → refresh → still logged in** | PASS |
| AUTH-006 | Login → navigate between pages | PASS |
| AUTH-007 | Expired/invalid access token → refresh recovers | PASS |
| AUTH-008 | Valid refresh token | PASS |
| AUTH-009 | Invalid refresh token → 401 | PASS |
| AUTH-010 | Expired/rotated refresh token reuse → 401 | PASS |
| AUTH-011 | Logout | PASS |
| AUTH-012 | Refresh after logout → 401 | PASS |
| AUTH-013 | Login again after logout | PASS |
| AUTH-014 | Direct authenticated request succeeds | PASS |
| AUTH-015 | Direct unauthenticated request → 401 | PASS |
| AUTH-016 | Multiple concurrent authenticated requests | PASS |
| AUTH-017 | `/auth/me` | PASS |
| AUTH-018 | Role-based route access (EMPLOYEE → HR dashboard) → 403 | PASS |
| AUTH-019 | Post-logout "back button" (stale refresh cookie) → 401 | PASS |
| AUTH-020 | Two tabs sharing a cookie jar | PASS |
| BUG-001 regression | Concurrent refresh race (the exact reported bug) | PASS — one clean 200, one clean 401, no crash |

## RBAC results

21/21 direct backend authorization tests passed across all 4 roles, including two server-side query-scope-bypass attempts (a manager trying to read another manager's team via an `?employee=` filter). Full detail in `RBAC_TEST_REPORT.md`.

## API results

See `API_TEST_REPORT.md` for the full 61-endpoint inventory and per-endpoint test status. Summary: every success case, validation case (400/422), auth case (401), authz case (403), and not-found case (404) that was exercised behaved correctly and consistently, using the project's standard `{ success, message, data, pagination? }` envelope throughout. No endpoint returned an HTML error page or a raw stack trace outside development mode.

## Frontend results

Reviewed all ~30 page/component files against their corresponding backend responses (request shape, response shape, pagination, nested fields like `notifications.data.{items,unreadCount}`). Found and fixed one guaranteed-crash bug (BUG-004) and one systemic broken-feature bug spanning 3 upload call sites (BUG-003). No other contract mismatches, `_id`/`id` inconsistencies, or dead/undefined references were found — `oxlint` (which catches undefined-JSX-reference bugs project-wide) passes clean except one pre-existing, unrelated fast-refresh advisory in `ToastProvider.jsx`. Dashboards handle empty/zero data without crashing (verified both by code review of the `EmptyChart` fallback and by hitting the dashboard APIs directly). Not independently verified: actual rendered appearance, responsive/dark-mode layout, and interactive click-paths, since no browser automation was available this session.

## Build result

- `cd client && npm run build` → **succeeds** (2561 modules, ~2.9s). One informational Vite warning about chunk size (see "Remaining issues" above) — not an error.
- `cd server && npm run lint` → **0 errors**, 2 pre-existing warnings in test files (after fixing BUG-005, which had left this command non-functional).
- `cd client && npm run lint` (oxlint) → **0 errors**, 1 pre-existing advisory (after fixing BUG-004, which this same command caught).

## Automated test result

`cd server && npm test` → **13/13 suites, 74/74 tests passing** (~19–20s), after fixing BUG-002 (dependency install + Jest parallelism). Coverage: JWT tokens, password hashing, pagination math, leave-day calculation, attendance-status derivation, payroll gross/net calculation (unit); auth, RBAC boundaries, employee CRUD, leave apply→approve flow, payroll generation (integration, via Supertest + in-memory MongoDB).

No new test files were added — the existing suite already covers the priority areas called out in the task (Authentication, RBAC, Employees, Leave approval, Payroll calculation) and continued to pass after the BUG-001 auth fix, confirming no regression. The one gap the existing suite doesn't cover — concurrent refresh-token rotation — was instead verified with a targeted, reproducible HTTP-level regression check (see BUG-001 in `BUGS.md`), which is a more faithful reproduction of the real race than a unit test could give.

## Manual end-to-end flow result

The Phase 27 scenario (SUPER_ADMIN → EMPLOYEE → MANAGER → EMPLOYEE → HR_ADMIN) was exercised **as an equivalent sequence of real API calls against the live server**, in the same order and with the same data-dependencies as the described click-path, since no browser was available:

- Login (each role) → refresh-token restore → dashboard API → **PASS** for all 4 roles
- HR: create department → create designation → create employee (with auto-provisioned login + emailed/logged temp password) → configure salary → **PASS**
- Employee: check in → apply leave → view own leave request → view notifications → **PASS**
- Manager: view team (attendance + leave scoped correctly) → view pending leave → approve leave → **PASS**
- Employee: confirm leave now Approved, confirm notification received, check out, view attendance history, view payroll → **PASS**
- HR: view employees, attendance, leave, generate payroll, export employees.xlsx, view audit logs → **PASS**

This confirms the underlying workflow end-to-end at the data/API layer. It does **not** confirm the literal UI click-path, form rendering, or visual behavior — that would require the browser session that wasn't available this run.

## Full test table

| ID | Feature | Test | Expected | Actual | Status |
|---|---|---|---|---|---|
| STARTUP-1 | Backend | `node server.js` with local Mongo | Starts, `/api/health` 200 | Started, health 200 | PASS |
| STARTUP-2 | Frontend | `npm run dev` | Vite serves on :5173 | Served, 200 | PASS |
| STARTUP-3 | Seed | `npm run seed` | Populates org/depts/employees/etc | Populated as documented | PASS |
| AUTH-001..020 | Auth | See table above | — | — | PASS (20/20) |
| BUG-001-regression | Auth | Concurrent refresh race | No crash, clean outcome | Clean 200+401 | PASS |
| RBAC-001..021 | RBAC | See RBAC_TEST_REPORT.md | — | — | PASS (21/21) |
| EMP-CRUD | Employees | List/create/update/status/search/pagination/filter combos | Correct, scoped per role | Correct | PASS |
| ORG-CRUD | Organization | Get/update/logo | Correct | Correct | PASS |
| DEPT-CRUD | Departments | CRUD + delete-guard | Correct, blocks delete with dependents | Correct | PASS |
| DESIG-CRUD | Designations | CRUD | Correct | Correct | PASS |
| ATT-001..007 | Attendance | Check-in/out incl. edge cases | Correct status codes | Correct | PASS (7/7) |
| LEAVE-001..017 | Leave | Apply/approve/reject/cancel incl. edge cases | Correct status transitions, no inconsistent states | Correct | PASS (17/17) |
| PAY-001..007 | Payroll | Salary config, generation, dedup, server-side gross/net | Correct, server-authoritative | Correct | PASS (7/7) |
| PAG-001..007 | Pagination/search | Edge cases (negative page, huge limit, no match, special chars) | Graceful, no 500s | Correct | PASS (7/7) |
| DASH-001..004 | Dashboard | All 3 role dashboards + no-profile edge case | Correct data, no crash | Correct | PASS (4/4) |
| NOTIF-001..004 | Notifications | List/mark read/mark all/cross-user access | Correct, no data leak | Correct | PASS (4/4) |
| PROF-001..003 | Profile | View/update/password/escalation attempt | Correct, no escalation | Correct | PASS (3/3) |
| EXP-001..002 | Export | xlsx content-type + RBAC | Correct | Correct | PASS (2/2) |
| VAL-001..006 | Validation | Malformed body, bad ObjectId, dup key, delete-guard | Clean 4xx, no leaks | Correct | PASS (6/6) |
| BUILD-1 | Frontend build | `npm run build` | Succeeds | Succeeded | PASS |
| LINT-1 | Backend lint | `npm run lint` | Runs, reports real issues | Fixed (was broken), now runs clean | PASS |
| LINT-2 | Frontend lint | `npm run lint` | Runs clean | Found + fixed BUG-004, now clean | PASS |
| JEST-1 | Backend tests | `npm test` | All pass | 74/74 pass | PASS |
| E2E-1 | Full 4-role workflow | See above | All steps succeed | All succeeded (API-level) | PASS |
| REDIS-1 | Cache (disabled path) | App works with `REDIS_ENABLED=false` | Works, no-op cache | Works | PASS |
| REDIS-2 | Cache (enabled path) | Cache-aside + invalidation | Not live-tested (no Redis instance) | — | NOT TESTED |
| CLOUD-1 | Uploads (Cloudinary unset) | Clean 503, no crash | Clean 503 | PASS |
| EMAIL-1 | Email (disabled) | Logs to console, doesn't block the request | Logged correctly | PASS |
| UI-1 | Rendered browser behavior | Visual/interactive check | Not available this session | — | NOT TESTED |

## Final quality gate

| Item | Status |
|---|---|
| Backend starts | ✓ |
| Frontend starts | ✓ |
| MongoDB connects | ✓ |
| Seed data works | ✓ |
| Login works | ✓ |
| **Login survives browser refresh** | ✓ (fixed — BUG-001) |
| Refresh token works | ✓ |
| Logout works | ✓ |
| Protected routes work | ✓ (code-verified; not browser-clicked) |
| RBAC works | ✓ |
| Employee CRUD works | ✓ |
| Organization works | ✓ |
| Departments work | ✓ |
| Designations work | ✓ |
| Attendance works | ✓ |
| Leave works | ✓ |
| Approval works | ✓ |
| Payroll works | ✓ |
| Dashboard works | ✓ |
| Notifications work | ✓ |
| Profile works | ✓ |
| Search works | ✓ |
| Filters work | ✓ |
| Pagination works | ✓ |
| Audit logs work | ✓ |
| Forms validate correctly | ✓ (code-verified against live backend validation) |
| APIs return correct status codes | ✓ |
| Frontend handles API errors | ✓ (consistent `err.response?.data?.message \|\| fallback` pattern throughout, no `[object Object]`) |
| No critical console errors | Not independently verified (no browser) — no `oxlint`/build-time errors |
| Frontend production build succeeds | ✓ |
