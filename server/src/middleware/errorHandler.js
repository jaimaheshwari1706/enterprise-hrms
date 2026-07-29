const ApiError = require('../utils/ApiError');
const env = require('../config/env');

// Catches every error forwarded via next(err) (including ones thrown inside
// asyncHandler-wrapped controllers) and turns it into the standard
// { success: false, message, errors } response shape.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err instanceof ApiError ? err.statusCode : 500;
  let message = err.message || 'Internal server error';
  let errors = err instanceof ApiError ? err.errors : null;

  // Common Mongoose errors get translated into friendlier responses.
  if (err.name === 'ValidationError') {
    statusCode = 422;
    errors = Object.values(err.errors).map((e) => e.message);
    message = 'Validation failed';
  }
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already exists` : 'Duplicate value';
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(env.nodeEnv === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
