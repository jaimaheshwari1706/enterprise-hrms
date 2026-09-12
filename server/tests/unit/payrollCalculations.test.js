const {
  roundMoney,
  calculateGrossSalary,
  calculateNetSalary,
  employmentWindow,
  computePayroll,
} = require('../../src/utils/payrollCalculations');
const { buildCalendar } = require('../../src/utils/workingDays');

const d = (iso) => new Date(`${iso}T00:00:00Z`);
const salary = { basic: 50000, hra: 20000, allowances: 5000, deductions: 3000 };
// August 2026: 31 calendar days, 21 weekdays (Mon–Fri); Aug 15 is a Saturday.
const monFri = buildCalendar({ workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });

describe('payrollCalculations basics', () => {
  it('computes gross salary as basic + hra + allowances', () => {
    expect(calculateGrossSalary(salary)).toBe(75000);
  });

  it('computes net salary as gross - deductions', () => {
    expect(calculateNetSalary(salary)).toBe(72000);
  });

  it('treats missing components as zero', () => {
    expect(calculateGrossSalary({ basic: 30000 })).toBe(30000);
    expect(calculateNetSalary({ basic: 30000 })).toBe(30000);
  });

  it('rounds to 2 decimal places (no floating-point drift)', () => {
    expect(calculateGrossSalary({ basic: 0.1, hra: 0.2, allowances: 0 })).toBe(0.3);
    expect(calculateNetSalary({ basic: 100.004, hra: 0, allowances: 0, deductions: 0.001 })).toBe(100);
    expect(roundMoney('12.345')).toBe(12.35);
    expect(roundMoney(undefined)).toBe(0);
  });
});

describe('employmentWindow', () => {
  it('covers the whole month for a long-standing employee', () => {
    const w = employmentWindow('2026-08', { joiningDate: d('2020-01-01'), exitDate: null });
    expect(w.from.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('starts at the joining date when joining mid-month', () => {
    const w = employmentWindow('2026-08', { joiningDate: d('2026-08-10') });
    expect(w.from.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('ends at the exit date when leaving mid-month', () => {
    const w = employmentWindow('2026-08', { joiningDate: d('2020-01-01'), exitDate: d('2026-08-20') });
    expect(w.from.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });

  it('is null when the employee joined after the month or left before it', () => {
    expect(employmentWindow('2026-08', { joiningDate: d('2026-09-01') })).toBeNull();
    expect(employmentWindow('2026-08', { joiningDate: d('2020-01-01'), exitDate: d('2026-07-31') })).toBeNull();
  });

  it('ignores the time of day on joining/exit dates', () => {
    const w = employmentWindow('2026-08', { joiningDate: new Date('2026-08-10T15:30:00Z') });
    expect(w.from.toISOString()).toBe('2026-08-10T00:00:00.000Z');
  });
});

describe('computePayroll — policy: none (fixed monthly salary)', () => {
  const policy = { proRataBasis: 'none', deductUnpaidLeave: false };

  it('pays the full structure for a full month', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri, policy });
    expect(p).toMatchObject({ basic: 50000, hra: 20000, allowances: 5000, deductions: 3000, grossSalary: 75000, netSalary: 72000 });
    expect(p.period).toMatchObject({ basis: 'none', totalDays: 31, employedDays: 31, payableDays: 31, factor: 1, monthWorkingDays: 21 });
  });

  it('still pays the full structure for a mid-month joiner (no pro-rata)', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-20'), calendar: monFri, policy });
    expect(p.netSalary).toBe(72000);
    expect(p.period.employedDays).toBe(12); // recorded for information
    expect(p.period.factor).toBe(1);
  });

  it('ignores unpaid leave', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri, policy, unpaidLeaveDays: 5 });
    expect(p.netSalary).toBe(72000);
    expect(p.period.unpaidLeaveDays).toBe(0);
  });

  it('returns null for someone not employed during the month', () => {
    expect(computePayroll({ salary, month: '2026-08', joiningDate: d('2026-09-01'), calendar: monFri, policy })).toBeNull();
  });
});

describe('computePayroll — policy: calendar days', () => {
  const policy = { proRataBasis: 'calendar', deductUnpaidLeave: true };

  it('pays the full structure for a full month with no unpaid leave', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri, policy });
    expect(p.netSalary).toBe(72000);
    expect(p.period).toMatchObject({ basis: 'calendar', totalDays: 31, payableDays: 31, factor: 1 });
  });

  it('pro-rates a mid-month joiner by calendar days (22/31)', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-10'), calendar: monFri, policy });
    expect(p.period).toMatchObject({ totalDays: 31, employedDays: 22, payableDays: 22 });
    expect(p.basic).toBe(roundMoney((50000 * 22) / 31)); // 35483.87
    expect(p.hra).toBe(roundMoney((20000 * 22) / 31)); // 14193.55
    expect(p.allowances).toBe(roundMoney((5000 * 22) / 31)); // 3548.39
    expect(p.deductions).toBe(roundMoney((3000 * 22) / 31)); // 2129.03
    // Gross/net are sums of the *rounded* components, never re-derived.
    expect(p.grossSalary).toBe(roundMoney(p.basic + p.hra + p.allowances));
    expect(p.netSalary).toBe(roundMoney(p.grossSalary - p.deductions));
    expect(p.grossSalary).toBe(53225.81);
    expect(p.netSalary).toBe(51096.78);
  });

  it('pro-rates a leaver by calendar days (20/31)', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), exitDate: d('2026-08-20'), calendar: monFri, policy });
    expect(p.period).toMatchObject({ employedDays: 20, payableDays: 20 });
    expect(p.basic).toBe(roundMoney((50000 * 20) / 31));
  });

  it('handles joining and leaving within the same month', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-10'), exitDate: d('2026-08-14'), calendar: monFri, policy });
    expect(p.period).toMatchObject({ employedDays: 5, payableDays: 5 });
    expect(p.basic).toBe(roundMoney((50000 * 5) / 31));
  });

  it('deducts unpaid leave days from payable days', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri, policy, unpaidLeaveDays: 3 });
    expect(p.period).toMatchObject({ employedDays: 31, unpaidLeaveDays: 3, payableDays: 28 });
    expect(p.basic).toBe(roundMoney((50000 * 28) / 31));
  });

  it('never deducts more unpaid days than the employee was employed', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-30'), calendar: monFri, policy, unpaidLeaveDays: 10 });
    expect(p.period).toMatchObject({ employedDays: 2, unpaidLeaveDays: 2, payableDays: 0, factor: 0 });
    expect(p.netSalary).toBe(0);
  });

  it('does not deduct unpaid leave when the policy flag is off', () => {
    const p = computePayroll({
      salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri,
      policy: { proRataBasis: 'calendar', deductUnpaidLeave: false }, unpaidLeaveDays: 3,
    });
    expect(p.period.payableDays).toBe(31);
    expect(p.netSalary).toBe(72000);
  });

  it('uses the real number of days in the month (Feb / leap year)', () => {
    const feb = computePayroll({ salary, month: '2028-02', joiningDate: d('2028-02-15'), calendar: monFri, policy });
    expect(feb.period).toMatchObject({ totalDays: 29, employedDays: 15 });
  });
});

describe('computePayroll — policy: working days', () => {
  const policy = { proRataBasis: 'working', deductUnpaidLeave: true };

  it('uses working days as the denominator (21 in Aug 2026)', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri, policy });
    expect(p.period).toMatchObject({ basis: 'working', totalDays: 21, employedDays: 21, payableDays: 21, factor: 1 });
    expect(p.netSalary).toBe(72000);
  });

  it('pro-rates a mid-month joiner by working days (Mon 10 Aug → 16/21)', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-10'), calendar: monFri, policy });
    expect(p.period).toMatchObject({ employedDays: 16, payableDays: 16 });
    expect(p.basic).toBe(roundMoney((50000 * 16) / 21));
  });

  it('a joiner on a weekend is paid from the next working day', () => {
    // Sat 15 Aug → working days from Mon 17 = 11
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-15'), calendar: monFri, policy });
    expect(p.period.employedDays).toBe(11);
  });

  it('excludes holidays from both numerator and denominator', () => {
    const withHoliday = buildCalendar({ holidays: [{ date: d('2026-08-12'), name: 'Founders Day' }] }); // Wednesday
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: withHoliday, policy });
    expect(p.period).toMatchObject({ totalDays: 20, employedDays: 20, factor: 1 });
    const joiner = computePayroll({ salary, month: '2026-08', joiningDate: d('2026-08-10'), calendar: withHoliday, policy });
    expect(joiner.period).toMatchObject({ totalDays: 20, employedDays: 15 });
  });

  it('respects a custom working week', () => {
    const sixDay = buildCalendar({ workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] });
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: sixDay, policy });
    expect(p.period.totalDays).toBe(26);
  });

  it('deducts unpaid leave working days', () => {
    const p = computePayroll({ salary, month: '2026-08', joiningDate: d('2020-01-01'), calendar: monFri, policy, unpaidLeaveDays: 2 });
    expect(p.period).toMatchObject({ payableDays: 19 });
    expect(p.basic).toBe(roundMoney((50000 * 19) / 21));
    expect(p.netSalary).toBe(roundMoney(p.basic + p.hra + p.allowances - p.deductions));
  });

  it('is deterministic: identical inputs give identical output', () => {
    const args = { salary, month: '2026-08', joiningDate: d('2026-08-10'), calendar: monFri, policy, unpaidLeaveDays: 1 };
    expect(computePayroll(args)).toEqual(computePayroll({ ...args }));
  });
});
