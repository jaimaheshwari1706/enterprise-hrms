const { z } = require('zod');

const designationSchema = z.object({
  name: z.string().min(2, 'Designation name is required'),
  code: z.string().min(2, 'Designation code is required').max(15),
  department: z.string().min(1, 'Department is required'),
  description: z.string().optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

module.exports = { designationSchema };
