require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Required for correct req.ip / secure-cookie detection and to satisfy
// express-rate-limit behind Render's (or any PaaS's) reverse proxy.
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server, same-origin) — allow.
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Reject without throwing: the `cors` package would otherwise call
      // next(err), turning every disallowed-origin probe into a logged 500.
      // Omitting the Access-Control-Allow-Origin header already makes the
      // browser block the response — that's the actual enforcement.
      console.warn(`[cors] blocked request from disallowed origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// Liveness — process is up. Always 200; does not depend on any dependency.
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Enterprise HRMS API is running', data: { env: env.nodeEnv } });
});

// Readiness — safe to receive traffic. Checks the one hard dependency
// (Mongo); Redis/Cloudinary/SMTP are all designed to degrade gracefully
// already, so they're not readiness-gating.
app.get('/api/ready', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({
    success: mongoReady,
    message: mongoReady ? 'Ready' : 'Not ready',
    data: { mongo: mongoose.STATES[mongoose.connection.readyState] },
  });
});

// Feature routes are mounted here as each phase builds them.
app.use('/api', require('./routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
