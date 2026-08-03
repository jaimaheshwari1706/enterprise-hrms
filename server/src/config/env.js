// Loads and validates environment variables in one place so the rest of the
// app never touches `process.env` directly. This makes it obvious what
// configuration the app depends on, and gives us one spot to add defaults.
require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

// JWT secrets must be set explicitly in production — falling back to the
// dev placeholders would let anyone forge a token (including SUPER_ADMIN)
// for a publicly-known secret. Fail at boot, not on the first login attempt.
if (nodeEnv === 'production' && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production (no dev fallback allowed).'
  );
}

const corsOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,

  // Render (and most PaaS) terminate TLS at a single reverse proxy hop in
  // front of the app. Without this, express-rate-limit throws on the
  // X-Forwarded-For header it sees, and req.ip resolves to the proxy's
  // address instead of the client's.
  trustProxy: nodeEnv === 'production' ? 1 : false,

  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/enterprise_hrms',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
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
