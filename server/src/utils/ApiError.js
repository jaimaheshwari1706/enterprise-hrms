// A small custom Error subclass so controllers/services can do:
//   throw new ApiError(404, 'Employee not found');
// and the central error handler knows exactly what status/message to send.
// `code` is a stable, machine-readable identifier the client can branch on
// (the message is for humans and may change).
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  423: 'LOCKED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

class ApiError extends Error {
  constructor(statusCode, message, errors = null, code = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code || DEFAULT_CODES[statusCode] || 'ERROR';
  }
}

ApiError.codes = DEFAULT_CODES;

module.exports = ApiError;
