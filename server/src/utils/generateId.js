const { Employee, Counter } = require('../models');

const EMPLOYEE_COUNTER = 'employeeId';
const EMPLOYEE_ID_RE = /^EMP(\d+)$/;

// Finds the highest existing EMPxxxx number so the counter can be seeded on
// databases that already have employees (created under the old
// countDocuments()+1 scheme).
async function currentMaxEmployeeNumber() {
  const docs = await Employee.find({ employeeId: EMPLOYEE_ID_RE }, { employeeId: 1 }).lean();
  return docs.reduce((max, d) => {
    const n = Number(d.employeeId.match(EMPLOYEE_ID_RE)?.[1] || 0);
    return n > max ? n : max;
  }, 0);
}

// Sequential, collision-free employee ids (EMP0001, EMP0002, ...).
// Step 1 seeds the counter once (a concurrent first call may lose the upsert
// race with a duplicate-key error, which is harmless — the other call
// seeded it). Step 2 is an atomic $inc, so every caller gets a unique value.
async function generateEmployeeId() {
  const existing = await Counter.findById(EMPLOYEE_COUNTER).lean();
  if (!existing) {
    const seed = await currentMaxEmployeeNumber();
    try {
      await Counter.updateOne({ _id: EMPLOYEE_COUNTER }, { $setOnInsert: { seq: seed } }, { upsert: true });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  const counter = await Counter.findOneAndUpdate(
    { _id: EMPLOYEE_COUNTER },
    { $inc: { seq: 1 } },
    { new: true }
  );

  return `EMP${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { generateEmployeeId };
