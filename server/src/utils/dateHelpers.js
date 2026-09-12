// Attendance and leave are keyed by a *business calendar day*, not by an
// instant. The day is decided in the organization's timezone
// (env.timezone / APP_TIMEZONE) and stored as UTC midnight of that day, so:
//
//   - the (employee, date) unique index still works as "one record per day";
//   - the stored value is independent of the server's own TZ (Render = UTC);
//   - a check-in at 02:00 IST lands on the correct IST day, not "yesterday";
//   - a date-only string from the client ("2026-09-15" -> UTC midnight)
//     produces exactly the same key.
const env = require('../config/env');

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns { year, month (1-12), day } of `date` as seen in `timeZone`.
function getCalendarParts(date, timeZone = env.timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

// Canonical day key: UTC midnight of the calendar day `date` falls on in the
// business timezone. Accepts a Date, a timestamp, or a parseable string.
function startOfDay(date = new Date(), timeZone = env.timezone) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return d; // let callers/validators reject it
  const { year, month, day } = getCalendarParts(d, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

function endOfDay(date = new Date(), timeZone = env.timezone) {
  const start = startOfDay(date, timeZone);
  if (Number.isNaN(start.getTime())) return start;
  return new Date(start.getTime() + DAY_MS - 1);
}

// Adds whole calendar days to a day key without DST surprises (day keys are
// UTC midnights, so plain arithmetic in UTC is exact).
function addDays(dayKey, days) {
  const d = new Date(dayKey);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// "YYYY-MM-DD" of a day key (or any date, evaluated in the business TZ).
function toDateString(date = new Date(), timeZone = env.timezone) {
  const { year, month, day } = getCalendarParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "YYYY-MM" for payroll/month grouping, in the business TZ, optionally
// shifted back by `offset` months.
function monthString(date = new Date(), offset = 0, timeZone = env.timezone) {
  const { year, month } = getCalendarParts(date, timeZone);
  const d = new Date(Date.UTC(year, month - 1 - offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Jan 1 (UTC midnight) of the current business year — used for annual
// leave balance windows.
function startOfYear(date = new Date(), timeZone = env.timezone) {
  const { year } = getCalendarParts(date, timeZone);
  return new Date(Date.UTC(year, 0, 1));
}

module.exports = {
  DAY_MS,
  startOfDay,
  endOfDay,
  addDays,
  toDateString,
  monthString,
  startOfYear,
  getCalendarParts,
};
