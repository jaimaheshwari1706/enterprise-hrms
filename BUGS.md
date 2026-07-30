# Bug Tracker

Statuses: OPEN, IN PROGRESS, FIXED, VERIFIED
Severity: CRITICAL, HIGH, MEDIUM, LOW

---

## BUG-001

Area: Authentication (refresh-token rotation / session bootstrap)
Severity: CRITICAL
Status: FIXED

Problem:
Login works and the dashboard loads, but a browser refresh sometimes logs the
user back out even though the refresh-token cookie is valid.

Expected:
Refreshing the browser while logged in silently restores the session via the
httpOnly refresh-token cookie; the dashboard stays accessible.

Actual:
On refresh, the app intermittently ends up in the `unauthenticated` state and
redirects to `/login`.

Root Cause:
1. `client/src/App.jsx` dispatches `bootstrapAuth()` in a `useEffect` with no
   guard against duplicate invocation. React's `<StrictMode>` (enabled in
   `client/src/main.jsx`) double-invokes effects on mount in development,
   firing **two concurrent** `POST /auth/refresh-token` requests using the
   *same* refresh-token cookie on every page load.
2. The backend's rotation logic in `server/src/controllers/auth.controller.js`
   did a non-atomic read-then-write (`RefreshToken.findOne()` → mutate →
   `.save()`), so two concurrent requests presenting the same token could
   both read it as "not yet revoked" before either write landed.
3. `generateRefreshToken` (`server/src/utils/tokens.js`) signed
   `{ sub: user._id }` with no per-token nonce. JWT `iat` only has
   second-granularity, so two tokens minted for the same user within the same
   second were byte-identical, causing the second `RefreshToken.create()` to
   throw a raw MongoDB duplicate-key error (11000) on the unique `tokenHash`
   index — surfaced to the client as an unrelated-looking 409.
4. Whichever of the two racing requests lost got a 401/409 and dispatched
   `bootstrapAuth.rejected`. Because Redux Toolkit applies reducers in
   whichever order the promises settle (not dispatch order), the rejected
   action sometimes landed *after* the fulfilled one, overwriting a valid
   `authenticated` state with `unauthenticated` — logging out a user who had
   a perfectly valid session.

Confirmed by direct HTTP testing (bypassing the browser): a fresh login
followed by two concurrent `POST /auth/refresh-token` calls with the same
cookie reliably reproduced one `409 tokenHash already exists` and one
`401 Refresh token is no longer valid`.

Files:
- client/src/App.jsx
- client/src/features/auth/authSlice.js
- server/src/controllers/auth.controller.js
- server/src/utils/tokens.js

Fix:
- `authSlice.js`: added an RTK `condition` guard to `bootstrapAuth` so a
  second concurrent dispatch (from StrictMode's double effect, or any other
  cause) bails out before ever making a network call, instead of racing the
  first.
- `tokens.js`: added a random `jti` nonce to the refresh-token payload so two
  tokens minted in the same second are never byte-identical.
- `auth.controller.js`: rotation now uses an atomic
  `RefreshToken.findOneAndUpdate({ tokenHash, user, revokedAt: null, expiresAt: { $gt: now } }, { revokedAt: now })`
  instead of `findOne` + `save()`, so a genuine concurrent race (e.g. two
  browser tabs) resolves as one clean 401 instead of a race/crash.

Verification:
- Reproduced the race directly via curl (two concurrent `/auth/refresh-token`
  calls on one fresh cookie) before the fix: one 409, one 401.
- Re-ran the same test after the fix: one clean 200 (with rotated cookie +
  new access token), one clean 401 — no duplicate-key error, no crash.
- Manual login → refresh → still-authenticated flow verified end-to-end (see
  API_TEST_REPORT.md / TEST_REPORT.md AUTH-005).

---

## BUG-002

Area: Backend tooling / test infrastructure
Severity: MEDIUM
Status: VERIFIED

Problem:
`npm install` had not been run for the backend beyond a partial/cached state
— `node_modules` existed but `jest`, `supertest`, and `mongodb-memory-server`
(all devDependencies) were missing, so `npm test` failed outright with
`Cannot find module 'supertest'`.

Separately, once dependencies were installed, running the full suite with
Jest's default parallelism started all 5 integration suites' in-memory
MongoDB instances at once; on this machine that resource contention caused
every integration suite to fail with
`MongoMemoryServer: Instance failed to start within 10000ms` (all 8 DB-free
unit suites passed normally in the same run, confirming the DB startup path
was the specific failure point).

Expected:
`npm install && npm test` in `server/` installs cleanly and reliably passes
all suites.

Actual:
`npm test` crashed on missing modules; after installing, all 5 integration
suites failed on Mongo instance startup timeouts under parallel execution.

Root Cause:
1. Stale/partial `node_modules` (environment issue, not a code defect).
2. `mongodb-memory-server`'s default instance-launch timeout (10s) is tight
   enough that starting 5 separate mongod processes concurrently (Jest's
   default per-file worker parallelism) exceeded it under contention.

Files:
- server/tests/setup.js
- server/jest.config.js

Fix:
- Ran a full `npm install` to restore complete devDependencies.
- `jest.config.js`: set `maxWorkers: 1` so integration suites start their
  in-memory Mongo instances one at a time instead of competing for
  resources.
- `tests/setup.js`: explicit `launchTimeout: 30000` on `MongoMemoryServer.create()`
  for extra headroom beyond the library default.

Verification:
- Re-ran `npm test`: 13/13 suites, 74/74 tests passing in ~20s.

---

## BUG-003

Area: File uploads (employee profile photo, organization logo, profile avatar)
Severity: CRITICAL
Status: VERIFIED

Problem:
Every image-upload feature in the app (employee profile photo, organization
logo, "my profile" avatar) was broken — selecting a valid image and
submitting always failed.

Expected:
Uploading a valid JPG/PNG/WEBP under the size limit succeeds and the image
URL is saved.

Actual:
The request fails server-side; multer/busboy cannot parse the multipart
body at all.

Root Cause:
All three upload API calls (`client/src/api/employeeApi.js`
`uploadProfileImage`, `organizationApi.js` `uploadLogo`, `profileApi.js`
`uploadAvatar`) built a `FormData` body but then manually forced
`headers: { 'Content-Type': 'multipart/form-data' }` on the axios request.
A `multipart/form-data` Content-Type is meaningless without a `boundary=`
parameter identifying where each field starts/ends — that boundary is
normally generated automatically by the HTTP client when it serializes a
`FormData` body, but only if the caller leaves the Content-Type header
unset. By setting it explicitly (without a boundary), these calls
suppressed that auto-generation.

This isn't adapter-specific guesswork — read directly from the installed
`axios@1.18.1` source (`client/node_modules/axios`):
- `lib/defaults/index.js` sets `adapter: ['xhr', 'http', 'fetch']` — in any
  real browser, `XMLHttpRequest` is available, so axios always picks the
  `xhr` adapter first.
- `lib/adapters/fetch.js` contains an explicit patch: "If data is FormData
  and Content-Type is multipart/form-data without boundary, delete it so
  fetch can set it correctly" — but `lib/adapters/xhr.js` has no equivalent
  fix (it only clears Content-Type when the body is `undefined`).
- So the one adapter real browsers actually use has no protection against
  this exact mistake.

Confirmed empirically against the running server (bypassing the browser
entirely, to isolate the server-side effect): a raw multipart POST with
`Content-Type: multipart/form-data` and no `boundary=` param — reproducing
exactly what the buggy client code sent — made busboy throw
`Multipart: Boundary not found`, surfaced as an unhandled-looking `500`
(worse than a clean 4xx). The identical request with a proper
`boundary=` param reached the controller fine (returned `503` for
Cloudinary-not-configured — i.e. the file itself parsed correctly).

Files:
- client/src/api/employeeApi.js
- client/src/api/organizationApi.js
- client/src/api/profileApi.js

Fix:
Removed the manual `Content-Type: 'multipart/form-data'` header from all
three calls, leaving axios/XHR to generate the correct
`multipart/form-data; boundary=...` header itself.

Verification:
- Re-ran the same raw-request test with no Content-Type header set (letting
  the client auto-generate it): server returned `503` (Cloudinary not
  configured in this dev environment) instead of the boundary error —
  confirming the file now parses successfully. Full end-to-end upload
  (through to a stored image URL) requires Cloudinary credentials, which
  this dev environment doesn't have configured; the 503 path itself is
  correct, documented behavior (README: "uploads fail with a clear 503
  rather than crashing" when Cloudinary is unset).

---

## BUG-004

Area: Frontend — Employee Detail page (Attendance / Leave / Payroll tabs)
Severity: HIGH
Status: VERIFIED

Problem:
`client/src/pages/employees/EmployeeDetailPage.jsx` referenced an
`<EmptyState />` component in four places (Attendance tab, Leave tab,
Payroll tab, and the "no permission" Payroll fallback) but only imported
`Loading` and `ErrorState` from `../../components/StateViews` —
`EmptyState` was never imported.

Expected:
Viewing any employee whose Attendance, Leave, or Payroll history is empty
(e.g. a brand-new hire, or any employee before their first check-in/leave
request/payroll run) shows a friendly "nothing here yet" empty state.

Actual:
React throws `ReferenceError: EmptyState is not defined` and crashes that
render whenever the corresponding array is empty — a very ordinary,
easy-to-hit case (every newly created employee starts with zero records in
all three tabs).

Root Cause:
Missing import — straightforward oversight, caught immediately by running
`oxlint` (which the project's own `npm run lint` script never surfaced
because it had never been run/wired up until this pass, see BUG-005).

Files:
- client/src/pages/employees/EmployeeDetailPage.jsx

Fix:
Added `EmptyState` to the import from `../../components/StateViews`. Also
removed an unused `ComingSoon` helper function flagged by the same lint
pass (dead leftover from an earlier build phase, no longer referenced
anywhere in the file).

Verification:
- Re-ran `npm run lint` in `client/`: the 4 `jsx-no-undef` errors and the
  `no-unused-vars` warning for `ComingSoon` are gone; only one pre-existing,
  unrelated fast-refresh advisory remains in `ToastProvider.jsx`.

---

## BUG-005

Area: Backend tooling — ESLint configuration
Severity: MEDIUM
Status: VERIFIED

Problem:
`server/package.json` defines `"lint": "eslint ."` and lists `eslint` as a
devDependency, but no ESLint config file (`.eslintrc.*` or
`eslint.config.js`) existed anywhere in the repo. Running `npm run lint`
failed immediately with "ESLint couldn't find a configuration file" — the
lint script had never actually been runnable.

Expected:
`npm run lint` runs ESLint over the backend source and reports real
issues.

Actual:
Hard failure before any file was even linted.

Root Cause:
Missing config file — this surfaced BUG-004 by proxy: linting was part of
this project's toolchain in name only, so an obvious undefined-reference
bug in the frontend sat unnoticed (frontend's `oxlint` doesn't have this
problem since oxlint ships usable defaults with no config file required,
which is why the frontend lint command already worked and immediately
caught BUG-004 as soon as it was actually run).

Files:
- server/.eslintrc.json (new)

Fix:
Added a minimal `.eslintrc.json`: `eslint:recommended`, Node + Jest globals,
CommonJS (`sourceType: "script"`, matching the codebase's `require`/
`module.exports` style throughout), and `no-unused-vars` scoped to ignore
unused function arguments (matching the existing pattern of unused Express
error-middleware `next` params).

Verification:
- `npm run lint` now runs cleanly: 0 errors, 2 pre-existing warnings (unused
  variables in two test files, unrelated to application code — left as-is,
  noted in TEST_REPORT.md).
