const { AuditLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

// GET /api/audit-logs?page=&limit=&search=&action=&entityType=
const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search, action, entityType } = req.query;

  const filter = {};
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (search) filter.description = { $regex: search, $options: 'i' };

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('user', 'email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return ok(res, { message: 'Audit logs', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/audit-logs/actions — distinct list of actions, used to populate the filter dropdown
const listDistinctActions = asyncHandler(async (req, res) => {
  const actions = await AuditLog.distinct('action');
  return ok(res, { message: 'Distinct actions', data: actions.sort() });
});

module.exports = { listAuditLogs, listDistinctActions };
