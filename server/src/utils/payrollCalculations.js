// Pure calculation functions, kept separate from the controller so they
// can be unit tested without touching MongoDB.

function calculateGrossSalary({ basic, hra, allowances }) {
  return basic + hra + allowances;
}

function calculateNetSalary({ basic, hra, allowances, deductions }) {
  return calculateGrossSalary({ basic, hra, allowances }) - deductions;
}

module.exports = { calculateGrossSalary, calculateNetSalary };
