const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Usage: router.post('/', authenticate, requireRole('HR_ADMIN', 'SUPER_ADMIN'), controller)
// Must run AFTER `authenticate` since it relies on req.user being set.
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      // A denied request is a signal worth keeping: repeated 403s from one
      // account usually mean a probe or a broken client, not a lost user.
      logger.warn('Authorization denied', {
        userId: req.user._id.toString(),
        role: req.user.role,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        requestId: req.id,
      });
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
}

module.exports = requireRole;
