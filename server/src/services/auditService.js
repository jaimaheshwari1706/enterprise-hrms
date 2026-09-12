const { AuditLog } = require('../models');
const logger = require('../utils/logger');

// A single, reusable place to write audit entries (Module 13). Any
// controller across the app can call this after a meaningful action
// (login, create employee, approve leave, ...) without duplicating the
// AuditLog.create(...) boilerplate everywhere.
//
// Intentionally fire-and-forget-safe: if writing the audit log fails, we
// log the error but never let it break the actual request.
async function logAction({ user, action, entityType, entityId = null, description = '', ip = '' }) {
  try {
    await AuditLog.create({
      user: user?._id || user || null,
      action,
      entityType,
      entityId,
      description,
      ipAddress: ip,
    });
  } catch (err) {
    logger.error('Failed to write audit log', { action, entityType, error: err });
  }
}

module.exports = { logAction };
