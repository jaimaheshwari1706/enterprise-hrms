require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const env = require('./config/env');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { isOriginAllowed } = require('./utils/corsOrigins');

const app = express();

// Required for correct req.ip / secure-cookie detection and to satisfy
// express-rate-limit behind Render's (or any PaaS's) reverse proxy.
if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}
app.disable('x-powered-by');

app.use(requestId);
app.use(helmet());

// CORS runs before body parsing, auth, routes and the 404 handler, so a
// browser preflight (OPTIONS) from an allowed origin is answered here with
// 204 for *any* path and never needs a token. The allow-list comes from
// CORS_ORIGINS / CLIENT_URL (normalised; `*` allowed only inside a host for
// Vercel preview deployments — see utils/corsOrigins).
//
// When the origin is NOT allowed the `cors` package calls plain next()
// without any headers, which would let the OPTIONS request fall through to
// routing and surface as a confusing "Route not found: OPTIONS …" 404. The
// small middleware after it turns that into an explicit 403 instead.
// Non-preflight requests from unknown origins still reach the routes (the
// browser blocks the response because no Access-Control-Allow-Origin is
// set; curl/server-to-server traffic without an Origin header is allowed).
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, health probes, server-to-server): not a CORS
      // request at all — let it through untouched, without CORS headers.
      if (!origin) return callback(null, false);
      if (isOriginAllowed(origin, env.corsOrigins)) return callback(null, true);
      logger.warn('CORS: blocked request from disallowed origin', { origin });
      return callback(null, false);
    },
    credentials: true, // refresh-token cookie + Authorization header
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Requested-With'],
    exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
    maxAge: 600, // browsers may cache the preflight for 10 minutes
    optionsSuccessStatus: 204,
  })
);
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.headers.origin && !isOriginAllowed(req.headers.origin, env.corsOrigins)) {
    return res.status(403).json({
      success: false,
      code: 'CORS_ORIGIN_DENIED',
      message: 'This origin is not allowed to call the API',
      ...(req.id ? { requestId: req.id } : {}),
    });
  }
  return next();
});
// The API only ever receives small JSON documents; file uploads go through
// multer with their own 2MB cap. A tight limit keeps a hostile client from
// forcing the process to buffer large bodies.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// Request logging: skip the health probes (Render polls them constantly)
// so real traffic stays readable. In production each access line is JSON
// carrying the request id (so it joins up with error/auth log lines) and
// the acting user id — never the token, body or query string values.
morgan.token('id', (req) => req.id);
morgan.token('user', (req) => req.user?._id?.toString() || '-');
const productionFormat = (tokens, req, res) =>
  JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    message: 'request',
    requestId: tokens.id(req, res),
    method: tokens.method(req, res),
    path: req.path,
    status: Number(tokens.status(req, res)),
    durationMs: Number(tokens['response-time'](req, res)),
    length: Number(tokens.res(req, res, 'content-length')) || 0,
    userId: tokens.user(req, res),
    ip: req.ip,
  });
app.use(
  morgan(env.isProduction ? productionFormat : 'dev', {
    skip: (req) => req.path === '/api/health' || req.path === '/api/ready',
  })
);

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

app.use('/api', apiLimiter, require('./routes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
