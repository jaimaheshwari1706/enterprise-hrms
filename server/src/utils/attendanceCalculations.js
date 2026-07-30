// A full day is 8 working hours; anything less (but still checked in/out)
// counts as a half day. Intentionally simple — no shift rules, no
// overtime, no break deductions.
const FULL_DAY_HOURS = 8;

function calculateWorkingHours(checkIn, checkOut) {
  const hours = (checkOut - checkIn) / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

function deriveAttendanceStatus(hoursWorked) {
  return hoursWorked >= FULL_DAY_HOURS ? 'Present' : 'HalfDay';
}

module.exports = { FULL_DAY_HOURS, calculateWorkingHours, deriveAttendanceStatus };
