const env = require('../config/env');

// Centralizes the httpOnly refresh-token cookie settings so login, refresh,
// and logout all use exactly the same options (otherwise the browser will
// silently fail to clear/overwrite the cookie on logout).
const REFRESH_COOKIE_NAME = 'refreshToken';

// `expiresAt` is the refresh JWT's own expiry (see tokens.getTokenExpiry) so
// the cookie lifetime always matches JWT_REFRESH_EXPIRY instead of a
// hard-coded 7 days.
function refreshCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/api/auth',
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

module.exports = { REFRESH_COOKIE_NAME, refreshCookieOptions };
