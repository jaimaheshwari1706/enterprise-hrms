const { z } = require('zod');

const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Department code is required').max(15),
  description: z.string().optional().or(z.literal('')),
  head: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

module.exports = { departmentSchema };
