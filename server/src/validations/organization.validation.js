const { z } = require('zod');

const updateOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name is required'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  timezone: z.string().optional(),
  workingDays: z.array(z.string()).optional(),
  officeStartTime: z.string().optional(),
  officeEndTime: z.string().optional(),
});

module.exports = { updateOrganizationSchema };
