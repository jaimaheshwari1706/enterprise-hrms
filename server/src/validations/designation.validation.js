const { z } = require('zod');
const { objectId, optionalText, pageQuery, sortQuery, searchQuery } = require('./common');

const designationSchema = z.object({
  name: z.string().trim().min(2, 'Designation name is required').max(80),
  code: z.string().trim().min(2, 'Designation code is required').max(15),
  department: objectId('Department'),
  description: optionalText(500),
  status: z.enum(['active', 'inactive']).optional(),
});

const DESIGNATION_SORT_FIELDS = ['createdAt', 'name', 'code', 'status'];

const listDesignationsQuery = z.object({
  ...pageQuery,
  sort: sortQuery(DESIGNATION_SORT_FIELDS),
  search: searchQuery,
  department: objectId('department').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional().or(z.literal('')),
});

module.exports = { designationSchema, listDesignationsQuery, DESIGNATION_SORT_FIELDS };
