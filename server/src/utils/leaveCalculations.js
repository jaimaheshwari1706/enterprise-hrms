const { startOfDay } = require('./dateHelpers');

// Inclusive day count between two dates — deliberately simple (no weekend
// or holiday exclusion), matching the "simplified leave management" scope.
function calculateLeaveDays(startDate, endDate) {
  const diffMs = startOfDay(endDate) - startOfDay(startDate);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

module.exports = { calculateLeaveDays };
