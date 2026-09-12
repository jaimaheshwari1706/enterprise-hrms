const { z } = require('zod');
const { objectId, optionalText, pageQuery, sortQuery, searchQuery } = require('./common');

const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Department name is required').max(80),
  code: z.string().trim().min(2, 'Department code is required').max(15),
  description: optionalText(500),
  head: objectId('Department head').optional().nullable().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

const DEPARTMENT_SORT_FIELDS = ['createdAt', 'name', 'code', 'status'];

const listDepartmentsQuery = z.object({
  ...pageQuery,
  sort: sortQuery(DEPARTMENT_SORT_FIELDS),
  search: searchQuery,
  status: z.enum(['active', 'inactive']).optional().or(z.literal('')),
});

module.exports = { departmentSchema, listDepartmentsQuery, DEPARTMENT_SORT_FIELDS };
