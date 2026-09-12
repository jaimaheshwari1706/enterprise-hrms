// The organization's working calendar, applied identically everywhere a
// "working day" matters: leave day counts, attendance absence, dashboards
// and (when the policy enables it) payroll pro-rating.
//
// All dates handled here are *day keys* — UTC midnight of a business
// calendar day (see dateHelpers.startOfDay). Because day keys are UTC
// midnights, `getUTCDay()` is the weekday of that business day and plain
// UTC date arithmetic never crosses a DST boundary.
const { addDays, toDateString } = require('./dateHelpers');

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_WORKING_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Normalises the organization document (or a plain object) into a fast
// lookup structure:
//   { workingDays: Set<weekday name>, holidays: Map<'YYYY-MM-DD', name> }
function buildCalendar({ workingDays, holidays } = {}) {
  const days = Array.isArray(workingDays) && workingDays.length ? workingDays : DEFAULT_WORKING_DAYS;
  const holidayMap = new Map();
  for (const holiday of holidays || []) {
    const date = holiday?.date instanceof Date ? holiday.date : new Date(holiday?.date);
    if (Number.isNaN(date.getTime())) continue;
    holidayMap.set(toDateString(date, 'UTC'), holiday.name || 'Holiday');
  }
  return { workingDays: new Set(days), holidays: holidayMap };
}

function weekdayName(dayKey) {
  return WEEKDAY_NAMES[dayKey.getUTCDay()];
}

function isWeekend(dayKey, calendar) {
  return !calendar.workingDays.has(weekdayName(dayKey));
}

function holidayName(dayKey, calendar) {
  return calendar.holidays.get(toDateString(dayKey, 'UTC')) || null;
}

function isHoliday(dayKey, calendar) {
  return calendar.holidays.has(toDateString(dayKey, 'UTC'));
}

// A working day is a configured weekday that is not a holiday. A holiday
// falling on a weekend is simply a weekend — it is never counted twice.
function isWorkingDay(dayKey, calendar) {
  return !isWeekend(dayKey, calendar) && !isHoliday(dayKey, calendar);
}

// Every day key in [start, end] (inclusive) with its classification.
// Returns [{ date, working, weekend, holiday }].
function classifyRange(start, end, calendar) {
  const out = [];
  if (!(start instanceof Date) || !(end instanceof Date) || end < start) return out;
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    const weekend = isWeekend(day, calendar);
    const holiday = weekend ? null : holidayName(day, calendar);
    out.push({ date: day, working: !weekend && !holiday, weekend, holiday });
  }
  return out;
}

// Only the working day keys in [start, end].
function listWorkingDays(start, end, calendar) {
  return classifyRange(start, end, calendar)
    .filter((d) => d.working)
    .map((d) => d.date);
}

// Number of working days in [start, end].
function countWorkingDays(start, end, calendar) {
  return listWorkingDays(start, end, calendar).length;
}

// Number of calendar days in [start, end] (inclusive), independent of the
// calendar — kept next to countWorkingDays so callers can pick a basis.
function countCalendarDays(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date) || end < start) return 0;
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

// Boundaries of a "YYYY-MM" month as day keys.
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 0)); // day 0 of next month = last day
  return { start, end };
}

module.exports = {
  WEEKDAY_NAMES,
  DEFAULT_WORKING_DAYS,
  buildCalendar,
  weekdayName,
  isWeekend,
  isHoliday,
  holidayName,
  isWorkingDay,
  classifyRange,
  listWorkingDays,
  countWorkingDays,
  countCalendarDays,
  monthRange,
};
