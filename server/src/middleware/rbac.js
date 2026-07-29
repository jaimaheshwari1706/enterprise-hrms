const ApiError = require('../utils/ApiError');

// Usage: router.post('/', authenticate, requireRole('HR_ADMIN', 'SUPER_ADMIN'), controller)
// Must run AFTER `authenticate` since it relies on req.user being set.
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = requireRole;
