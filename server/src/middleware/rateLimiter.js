const rateLimit = require('express-rate-limit');

// Applied only to auth endpoints (login, forgot-password) to slow down
// brute-force / credential-stuffing attempts. Everything else is left
// unthrottled since this is a portfolio project, not a public API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

module.exports = { authLimiter };
