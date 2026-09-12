const { z } = require('zod');
const { pageQuery, sortQuery, searchQuery, dateString } = require('./common');

const listAuditLogsQuery = z.object({
  ...pageQuery,
  sort: sortQuery(['createdAt', 'action', 'entityType']),
  search: searchQuery,
  action: z.string().trim().max(60).regex(/^[A-Z_]*$/, 'Invalid action').optional().or(z.literal('')),
  entityType: z.string().trim().max(60).regex(/^[A-Za-z]*$/, 'Invalid entity type').optional().or(z.literal('')),
  from: dateString('from').optional().or(z.literal('')),
  to: dateString('to').optional().or(z.literal('')),
});

module.exports = { listAuditLogsQuery };
