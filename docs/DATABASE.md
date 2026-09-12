# Database notes

MongoDB (Atlas in production). Mongoose declares every index on the schemas and
creates missing ones at boot (`autoIndex`). Mongoose never **drops** an index,
so removals below are manual.

## Collections, indexes and why

| Collection | Index | Purpose |
|---|---|---|
| `users` | `{email:1}` unique | login lookup, one account per email |
| `refreshtokens` | `{tokenHash:1}` unique | refresh lookup by hash (raw token never stored) |
| | `{expiresAt:1}` TTL (0s) | expired rows purged automatically |
| | `{family:1, revokedAt:1}` | family-wide revocation (reuse detection, logout) |
| | `{user:1, revokedAt:1, expiresAt:1}` | session list, sign-out-everywhere |
| `employees` | `{employeeId:1}` unique, `{email:1}` unique | identity |
| | `{manager:1,status:1}` | every MANAGER-scoped query |
| | `{department:1,status:1}`, `{designation:1}` | list filters, delete guards |
| | `{status:1,firstName:1,lastName:1}` | options/list default sort |
| | `{joiningDate:-1}` | dashboard joiners / trend |
| `attendance` | `{employee:1,date:1}` unique | one record per business day |
| | `{date:1,status:1}` | org-wide "today" / 7-day counts |
| `leaverequests` | `{employee:1,status:1}` | balance aggregation |
| | `{status:1,createdAt:-1}` | approval queue |
| | `{employee:1,startDate:1,endDate:1}` | overlap check, month intersection for unpaid leave |
| `leavetypes` | `{name:1}` unique | |
| `approvals` | `{requestType:1,requestId:1}`, `{approver:1,status:1}` | |
| `salaries` | `{employee:1}` unique | one structure per employee |
| `payrolls` | `{employee:1,month:1}` unique | one payslip per employee-month (duplicate generation guard) |
| | `{month:-1,status:1}` | HR list + dashboard totals |
| | `{payslipNumber:1}` unique **partial** (`$type: 'string'`) | payslip reference lookup; partial so legacy rows without a number don't collide |
| `notifications` | `{user:1,createdAt:-1}`, `{user:1,isRead:1}` | bell feed / unread badge |
| | `{createdAt:1}` TTL 180 days | notifications are ephemeral; the audit log is the permanent record |
| `auditlogs` | `{entityType:1,entityId:1}`, `{createdAt:-1}`, `{action:1,createdAt:-1}` | entity history, list, action filter |
| `counters` | `_id` | atomic sequences (`employeeId`, `payslip:YYYY-MM`) |
| `organizations` | none (single document) | |

## Manual Atlas migration (one-time, after deploying this version)

1. **Drop the unused employee text index.** No query uses `$text` any more
   (search is an escaped, case-insensitive regex so partial matches work).
   Text indexes are expensive on every write.
   ```js
   db.employees.dropIndex('firstName_text_lastName_text_employeeId_text_email_text')
   ```
2. **Payroll `payslipNumber` index.** If an earlier deploy created a plain
   `sparse` unique index, drop it before boot so Mongoose can create the partial
   one (otherwise index creation logs a conflict and the field is unindexed):
   ```js
   db.payrolls.dropIndex('payslipNumber_1')
   ```
3. **Refresh tokens.** Rows created before this version have no `family`. They
   are still honoured until they expire (≤ `JWT_REFRESH_EXPIRY`), but they can't
   be revoked as a family; the TTL index clears them out. To force everyone
   through a fresh login instead: `db.refreshtokens.deleteMany({ family: { $exists: false } })`.
4. **Notification TTL.** Mongoose creates the TTL index at boot; on a very large
   `notifications` collection create it in the background first from Atlas
   (`{ createdAt: 1 }, { expireAfterSeconds: 15552000 }`).
5. New fields with safe defaults, no backfill needed: `organizations.holidays`,
   `organizations.payrollPolicy`, `leavetypes.isPaid` (defaults to paid),
   `employees.exitDate`, `users.tokenVersion`, `payrolls.period` /
   `payslipNumber` / `generatedBy` / `processedAt` / `paidAt`.

## Referential integrity / orphan risks

- Departments and designations refuse deletion while employees (or
  designations) reference them (409).
- Employees are never deleted, only deactivated (login disabled, sessions
  revoked, `exitDate` recorded).
- Leave types have no delete endpoint (requests reference them).
- `Approval.requestId` uses `refPath` with the enum value `LEAVE`, which is not
  a model name; nothing populates it today. Cosmetic, tracked in the audit.
- `Employee.user` ↔ `User.employee` are kept in sync on create; if provisioning
  the login fails the employee row is deleted (compensation).
