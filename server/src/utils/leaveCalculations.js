const { startOfDay } = require('./dateHelpers');
const { classifyRange, countCalendarDays } = require('./workingDays');

// Leave is counted in *working days* against the organization's calendar:
// weekends (days outside Organization.workingDays) and configured holidays
// inside the range are not charged to the employee's balance. A holiday on
// a weekend is only ever skipped once.
//
// Returns { days, calendarDays, weekendDays, holidayDays, holidays: [name] }.
// `days` is what the request is charged.
function summarizeLeaveRange(startDate, endDate, calendar) {
  const start = startOfDay(startDate, 'UTC');
  const end = startOfDay(endDate, 'UTC');
  const classified = classifyRange(start, end, calendar);
  const summary = { days: 0, calendarDays: countCalendarDays(start, end), weekendDays: 0, holidayDays: 0, holidays: [] };
  for (const day of classified) {
    if (day.working) summary.days += 1;
    else if (day.weekend) summary.weekendDays += 1;
    else {
      summary.holidayDays += 1;
      summary.holidays.push(day.holiday);
    }
  }
  return summary;
}

function calculateLeaveDays(startDate, endDate, calendar) {
  return summarizeLeaveRange(startDate, endDate, calendar).days;
}

module.exports = { calculateLeaveDays, summarizeLeaveRange };
