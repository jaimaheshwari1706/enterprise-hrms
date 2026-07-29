// Loads and validates environment variables in one place so the rest of the
// app never touches `process.env` directly. This makes it obvious what
// configuration the app depends on, and gives us one spot to add defaults.
require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

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

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

module.exports = env;
