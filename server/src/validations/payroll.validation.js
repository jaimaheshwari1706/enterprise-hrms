const { z } = require('zod');
const { objectId, monthString, pageQuery, sortQuery } = require('./common');

const PAYROLL_STATUSES = ['Draft', 'Processed', 'Paid'];

// Money fields: non-negative, at most 2 decimals, sane upper bound so a
// mistyped value (or a script) can't create a 1e300 salary.
const money = (label) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .nonnegative(`${label} cannot be negative`)
    .max(1_000_000_000, `${label} is unrealistically large`)
    .refine((v) => Math.round(v * 100) === v * 100, `${label} can have at most 2 decimal places`);

const salarySchema = z.object({
  basic: money('Basic salary'),
  hra: money('HRA'),
  allowances: money('Allowances'),
  deductions: money('Deductions'),
});

const generatePayrollSchema = z.object({
  month: monthString('Month'),
  employeeId: objectId('employeeId').optional(), // omit to generate for all active employees
});

const updatePayrollStatusSchema = z.object({
  status: z.enum(PAYROLL_STATUSES),
});

const PAYROLL_SORT_FIELDS = ['month', 'createdAt', 'netSalary', 'grossSalary', 'status'];

const listPayrollQuery = z.object({
  ...pageQuery,
  sort: sortQuery(PAYROLL_SORT_FIELDS),
  month: monthString('month').optional().or(z.literal('')),
  employee: objectId('employee').optional().or(z.literal('')),
  status: z.enum(PAYROLL_STATUSES).optional().or(z.literal('')),
});

const myPayrollQuery = z.object({
  ...pageQuery,
  sort: sortQuery(['month', 'netSalary']),
});

const employeeIdParam = z.object({ employeeId: objectId('employeeId') });

module.exports = {
  salarySchema,
  generatePayrollSchema,
  updatePayrollStatusSchema,
  listPayrollQuery,
  myPayrollQuery,
  employeeIdParam,
  PAYROLL_SORT_FIELDS,
  PAYROLL_STATUSES,
};
