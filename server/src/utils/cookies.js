const env = require('../config/env');

// Centralizes the httpOnly refresh-token cookie settings so login, refresh,
// and logout all use exactly the same options (otherwise the browser will
// silently fail to clear/overwrite the cookie on logout).
const REFRESH_COOKIE_NAME = 'refreshToken';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches JWT_REFRESH_EXPIRY default
  };
}

module.exports = { REFRESH_COOKIE_NAME, refreshCookieOptions };
