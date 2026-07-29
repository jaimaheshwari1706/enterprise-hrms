const { Employee } = require('../models');

// Simple sequential ID generator (EMP0001, EMP0002, ...). Good enough for
// a portfolio-scale app; a high-concurrency production system would use a
// dedicated counters collection instead to avoid a race between the count
// and the insert, but collisions here are extremely unlikely and, if one
// ever happens, the unique index on `employeeId` will surface it as a
// clear 409 error rather than silently overwriting data.
async function generateEmployeeId() {
  const count = await Employee.countDocuments();
  return `EMP${String(count + 1).padStart(4, '0')}`;
}

module.exports = { generateEmployeeId };
