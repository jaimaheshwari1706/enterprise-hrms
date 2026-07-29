// Wraps an async controller so any thrown/rejected error is forwarded to
// Express's error-handling middleware instead of crashing the process or
// requiring a try/catch in every single controller function.
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
