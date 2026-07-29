// A small custom Error subclass so controllers/services can do:
//   throw new ApiError(404, 'Employee not found');
// and the central error handler knows exactly what status/message to send.
class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

module.exports = ApiError;
