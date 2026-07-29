const { z } = require('zod');

const applyLeaveSchema = z.object({
  leaveType: z.string().min(1, 'Leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(3, 'Please provide a reason (at least 3 characters)'),
});

const decisionSchema = z.object({
  comment: z.string().optional().or(z.literal('')),
});

module.exports = { applyLeaveSchema, decisionSchema };
