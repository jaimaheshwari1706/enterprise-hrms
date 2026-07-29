const crypto = require('crypto');

// Generates a readable-enough temporary password for newly created
// employee logins (e.g. "Xk4mPqRt9v"). The employee is expected to change
// it after their first login via the Profile module (Phase 10/14).
function generateTempPassword() {
  const raw = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  return (raw.slice(0, 10) || 'Temp1234').padEnd(8, '9');
}

module.exports = { generateTempPassword };
