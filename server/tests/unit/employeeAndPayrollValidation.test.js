const { createEmployeeSchema, updateStatusSchema } = require('../../src/validations/employee.validation');
const { salarySchema, generatePayrollSchema } = require('../../src/validations/payroll.validation');

describe('employee.validation', () => {
  const validEmployee = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@acme.com',
    joiningDate: '2024-01-15',
    department: '507f1f77bcf86cd799439011',
    designation: '507f1f77bcf86cd799439012',
  };

  it('accepts a valid employee payload', () => {
    expect(createEmployeeSchema.safeParse(validEmployee).success).toBe(true);
  });

  it('rejects a payload missing department', () => {
    const { department, ...rest } = validEmployee;
    expect(createEmployeeSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(createEmployeeSchema.safeParse({ ...validEmployee, email: 'not-an-email' }).success).toBe(false);
  });

  it('accepts a valid status transition value', () => {
    expect(updateStatusSchema.safeParse({ status: 'inactive' }).success).toBe(true);
  });

  it('rejects an invalid status value', () => {
    expect(updateStatusSchema.safeParse({ status: 'banned' }).success).toBe(false);
  });
});

describe('payroll.validation', () => {
  it('accepts a valid salary structure', () => {
    expect(
      salarySchema.safeParse({ basic: 50000, hra: 20000, allowances: 5000, deductions: 2000 }).success
    ).toBe(true);
  });

  it('rejects negative salary components', () => {
    expect(
      salarySchema.safeParse({ basic: -100, hra: 0, allowances: 0, deductions: 0 }).success
    ).toBe(false);
  });

  it('accepts a valid YYYY-MM month', () => {
    expect(generatePayrollSchema.safeParse({ month: '2026-08' }).success).toBe(true);
  });

  it('rejects an invalid month (13)', () => {
    expect(generatePayrollSchema.safeParse({ month: '2026-13' }).success).toBe(false);
  });

  it('rejects a malformed month string', () => {
    expect(generatePayrollSchema.safeParse({ month: 'August-2026' }).success).toBe(false);
  });
});
