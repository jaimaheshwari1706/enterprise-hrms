const { z } = require('zod');

const salarySchema = z.object({
  basic: z.number().nonnegative('Basic salary cannot be negative'),
  hra: z.number().nonnegative('HRA cannot be negative'),
  allowances: z.number().nonnegative('Allowances cannot be negative'),
  deductions: z.number().nonnegative('Deductions cannot be negative'),
});

const generatePayrollSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format'),
  employeeId: z.string().optional(), // omit to generate for all active employees
});

const updatePayrollStatusSchema = z.object({
  status: z.enum(['Draft', 'Processed', 'Paid']),
});

module.exports = { salarySchema, generatePayrollSchema, updatePayrollStatusSchema };
