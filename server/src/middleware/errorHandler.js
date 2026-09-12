const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');

// Catches every error forwarded via next(err) (including ones thrown inside
// asyncHandler-wrapped controllers) and turns it into the standard
//   { success: false, message, code, errors?, requestId? }
// response shape. In production nothing internal (stack traces, driver
// messages, file paths) ever reaches the client — only a generic message
// plus a requestId that can be matched against the server logs.
function translateError(err) {
  // Our own errors carry everything we need.
  if (err instanceof ApiError) {
    return { statusCode: err.statusCode, message: err.message, code: err.code, errors: err.errors };
  }

  // Mongoose schema validation.
  if (err.name === 'ValidationError' && err.errors) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    };
  }

  // Malformed ObjectId etc.
  if (err.name === 'CastError') {
    return { statusCode: 400, code: 'BAD_REQUEST', message: `Invalid value for ${err.path}` };
  }

  // Unique index violation.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return {
      statusCode: 409,
      code: 'DUPLICATE',
      message: field ? `A record with this ${field} already exists` : 'Duplicate value',
    };
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return { statusCode: 401, code: 'TOKEN_INVALID', message: 'Invalid or expired token' };
  }

  // multer (file uploads).
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 2MB)' : err.message;
    return { statusCode: 400, code: 'UPLOAD_ERROR', message };
  }

  // body-parser: malformed JSON, oversized bodies, unsupported charset...
  // These carry a 4xx `status`/`statusCode` and must not be reported as 500.
  const status = err.statusCode || err.status;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    if (err.type === 'entity.parse.failed') {
      return { statusCode: 400, code: 'BAD_REQUEST', message: 'Request body is not valid JSON' };
    }
    if (err.type === 'entity.too.large') {
      return { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' };
    }
    return { statusCode: status, code: ApiError.codes[status] || 'BAD_REQUEST', message: err.message || 'Bad request' };
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { statusCode, code, errors } = translateError(err);
  let { message } = translateError(err);

  if (statusCode >= 500) {
    logger.error('Unhandled request error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      userId: req.user?._id?.toString(),
      error: err,
    });
    // Never leak driver/library internals in production.
    if (env.isProduction) message = 'Something went wrong on our side. Please try again later.';
    else if (err.message) message = err.message;
  }

  if (res.headersSent) {
    // Streaming responses (e.g. Excel export) may have started already;
    // Express's default handler will close the connection.
    return next(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(errors ? { errors } : {}),
    ...(req.id ? { requestId: req.id } : {}),
    ...(!env.isProduction && statusCode >= 500 && err.stack ? { stack: err.stack } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
