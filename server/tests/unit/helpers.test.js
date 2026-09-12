const { escapeRegex, containsRegex } = require('../../src/utils/regex');
const { getSort } = require('../../src/utils/pagination');
const { roundMoney, calculateGrossSalary, calculateNetSalary } = require('../../src/utils/payrollCalculations');
const { strongPassword, dateString, objectId } = require('../../src/validations/common');
const { changePasswordSchema } = require('../../src/validations/profile.validation');
const { applyLeaveSchema } = require('../../src/validations/leave.validation');
const { updateOrganizationSchema } = require('../../src/validations/organization.validation');

describe('regex escaping', () => {
  it('escapes every regex metacharacter so user input is matched literally', () => {
    const re = containsRegex('a.b*c+d?e^f$g(h)i|j[k]l{m}n\\o');
    expect(re.test('xa.b*c+d?e^f$g(h)i|j[k]l{m}n\\oy')).toBe(true);
    expect(re.test('aXbYcZ')).toBe(false);
  });

  it('is case-insensitive and truncates absurdly long input', () => {
    expect(containsRegex('JoHn').test('john doe')).toBe(true);
    expect(escapeRegex('a'.repeat(500)).length).toBe(100);
  });

  it('does not let a pathological pattern become a regex', () => {
    const re = containsRegex('(a+)+$');
    const started = Date.now();
    re.test('a'.repeat(40) + '!');
    expect(Date.now() - started).toBeLessThan(50);
  });
});

describe('getSort', () => {
  it('parses "-field" as descending with an _id tie-breaker', () => {
    expect(getSort({ sort: '-createdAt' }, ['createdAt', 'name'], { createdAt: -1 })).toEqual({ createdAt: -1, _id: -1 });
    expect(getSort({ sort: 'name' }, ['createdAt', 'name'], { createdAt: -1 })).toEqual({ name: 1, _id: 1 });
  });

  it('ignores fields outside the whitelist and falls back to the default', () => {
    expect(getSort({ sort: 'passwordHash' }, ['createdAt'], { createdAt: -1 })).toEqual({ createdAt: -1, _id: -1 });
    expect(getSort({}, ['createdAt'], { month: -1 })).toEqual({ month: -1, _id: -1 });
  });
});

describe('payroll rounding', () => {
  it('rounds floating point sums to 2 decimals', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(calculateGrossSalary({ basic: 1000.1, hra: 200.2, allowances: 0.7 })).toBe(1201);
    expect(calculateNetSalary({ basic: 1000.1, hra: 200.2, allowances: 0.7, deductions: 0.33 })).toBe(1200.67);
  });

  it('treats missing components as zero', () => {
    expect(calculateGrossSalary({ basic: 500 })).toBe(500);
  });
});

describe('common validation primitives', () => {
  it('strongPassword requires 8+ chars with a letter and a number', () => {
    expect(strongPassword().safeParse('short1').success).toBe(false);
    expect(strongPassword().safeParse('onlyletters').success).toBe(false);
    expect(strongPassword().safeParse('12345678').success).toBe(false);
    expect(strongPassword().safeParse('Welcome2026').success).toBe(true);
  });

  it('changePasswordSchema rejects reusing the current password', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'Welcome2026', newPassword: 'Welcome2026' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'Welcome2026' }).success).toBe(true);
  });

  it('dateString rejects impossible calendar dates', () => {
    expect(dateString().safeParse('2026-02-30').success).toBe(false);
    expect(dateString().safeParse('2026-13-01').success).toBe(false);
    expect(dateString().safeParse('15/09/2026').success).toBe(false);
    expect(dateString().safeParse('2026-09-15').success).toBe(true);
  });

  it('objectId rejects operator injection objects and malformed ids', () => {
    expect(objectId().safeParse({ $ne: 'x' }).success).toBe(false);
    expect(objectId().safeParse('123').success).toBe(false);
    expect(objectId().safeParse('6aa4e1e584f0a799fcede205').success).toBe(true);
  });

  it('applyLeaveSchema rejects an end date before the start date', () => {
    const base = { leaveType: '6aa4e1e584f0a799fcede205', reason: 'Trip' };
    expect(applyLeaveSchema.safeParse({ ...base, startDate: '2026-09-15', endDate: '2026-09-14' }).success).toBe(false);
    expect(applyLeaveSchema.safeParse({ ...base, startDate: '2026-09-15', endDate: '2026-09-15' }).success).toBe(true);
  });

  it('organization schema validates timezone, weekdays and office hours', () => {
    expect(updateOrganizationSchema.safeParse({ name: 'Acme', timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ name: 'Acme', workingDays: ['Funday'] }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ name: 'Acme', officeStartTime: '18:00', officeEndTime: '09:00' }).success).toBe(false);
    expect(
      updateOrganizationSchema.safeParse({ name: 'Acme', timezone: 'Asia/Kolkata', workingDays: ['Monday'], officeStartTime: '09:30', officeEndTime: '18:30' }).success
    ).toBe(true);
  });
});
