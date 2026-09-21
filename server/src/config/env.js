// Loads and validates environment variables in one place so the rest of the
// app never touches `process.env` directly. This makes it obvious what
// configuration the app depends on, and gives us one spot to add defaults.
require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function fail(message) {
  throw new Error(`[env] ${message}`);
}

// --- Production guards -----------------------------------------------------
// Everything here is a misconfiguration that would otherwise surface as a
// confusing runtime failure (or, worse, silently run against the wrong
// database / with forgeable tokens). Fail at boot instead.
if (isProduction) {
  if (!process.env.MONGO_URI) {
    fail('MONGO_URI must be set in production (no localhost fallback allowed).');
  }
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    fail('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production (no dev fallback allowed).');
  }
  if (process.env.JWT_ACCESS_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32) {
    fail('JWT secrets must be at least 32 characters long in production.');
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    fail('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }
}

// The business timezone used to decide which calendar day an attendance
// check-in or a leave day belongs to. Render runs in UTC, so without this
// an employee in Asia/Kolkata checking in at 02:00 would be recorded on the
// previous day. Validated with Intl so a typo fails at boot, not at the
// first check-in.
const timezone = process.env.APP_TIMEZONE || 'Asia/Kolkata';
try {
  new Intl.DateTimeFormat('en-US', { timeZone: timezone });
} catch {
  fail(`APP_TIMEZONE "${timezone}" is not a valid IANA timezone (e.g. Asia/Kolkata, UTC, America/New_York).`);
}

// Browser origins allowed to call the API with credentials. Normalised
// (trim, no trailing slash, lower-case) and may contain `*` in the host for
// Vercel preview deployments — see utils/corsOrigins. Production must list
// every origin the frontend is served from; there is no wildcard fallback.
const { parseAllowedOrigins } = require('../utils/corsOrigins');
const corsOriginsRaw = process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigins = parseAllowedOrigins(corsOriginsRaw);
if (isProduction && corsOrigins.length === 0) {
  fail('CORS_ORIGINS (or CLIENT_URL) must list at least one valid https://origin in production.');
}

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  timezone,

  // Render (and most PaaS) terminate TLS at a single reverse proxy hop in
  // front of the app. Without this, express-rate-limit throws on the
  // X-Forwarded-For header it sees, and req.ip resolves to the proxy's
  // address instead of the client's.
  trustProxy: isProduction ? 1 : false,

  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/enterprise_hrms',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  auth: {
    // Per-account brute-force protection (independent of the IP limiter).
    maxFailedLogins: Number(process.env.AUTH_MAX_FAILED_LOGINS) || 5,
    lockoutMinutes: Number(process.env.AUTH_LOCKOUT_MINUTES) || 15,
    // Refresh-token rotation: a token that was rotated less than this many
    // seconds ago may be presented once more without being treated as
    // theft. Covers the real-world race where the browser never received
    // the new cookie (reload during page load, dropped response); outside
    // the window any reuse revokes the whole session family. 0 disables it.
    refreshReuseGraceSeconds: process.env.AUTH_REFRESH_REUSE_GRACE_SECONDS === undefined ? 30 : Number(process.env.AUTH_REFRESH_REUSE_GRACE_SECONDS) || 0,
  },

  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'Enterprise HRMS <no-reply@hrms.local>',
  },

  // Used for building links in emails (password reset, etc). Kept separate
  // from corsOrigins since CORS may need to allow more than one origin
  // (e.g. a Vercel preview URL) while emails should only ever link to one.
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins,
};

module.exports = env;
