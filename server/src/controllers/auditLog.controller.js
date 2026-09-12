const { AuditLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta, getSort } = require('../utils/pagination');
const { containsRegex } = require('../utils/regex');
const { startOfDay, endOfDay } = require('../utils/dateHelpers');

// GET /api/audit-logs?page=&limit=&sort=&search=&action=&entityType=&from=&to=
const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ['createdAt', 'action', 'entityType'], { createdAt: -1 });
  const { search, action, entityType, from, to } = req.query;

  const filter = {};
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (search) filter.description = containsRegex(search);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = startOfDay(`${from}T00:00:00Z`);
    if (to) filter.createdAt.$lte = endOfDay(`${to}T00:00:00Z`);
  }

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('user', 'email role')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
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
