// Attendance is keyed by (employee, date) where `date` is always midnight —
// this lets us use a simple unique compound index instead of comparing
// date ranges everywhere.
function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

module.exports = { startOfDay, endOfDay };
