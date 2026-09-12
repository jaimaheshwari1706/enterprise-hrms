// Pure payroll calculations, kept separate from the controller so they can
// be unit tested without touching MongoDB. Nothing in here reads the clock
// or the database: every input is passed in, so the same inputs always
// produce the same payroll.
//
// All money values are rounded to 2 decimal places: salary components are
// entered with up to two decimals, and plain floating-point addition of
// decimals (0.1 + 0.2) would otherwise store 72000.00000000001.
const { countCalendarDays, countWorkingDays, monthRange } = require('./workingDays');

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function calculateGrossSalary({ basic, hra, allowances }) {
  return roundMoney(Number(basic || 0) + Number(hra || 0) + Number(allowances || 0));
}

function calculateNetSalary({ basic, hra, allowances, deductions }) {
  return roundMoney(calculateGrossSalary({ basic, hra, allowances }) - Number(deductions || 0));
}

// Normalises a Date (or date-like) to a UTC day key, or null.
function dayKeyOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// The part of `month` during which the employee was employed:
// [max(month start, joining), min(month end, exit)]. Returns null when the
// employee was not employed at all during the month (joined after it ended
// or left before it started) — such employees get no payroll.
function employmentWindow(month, { joiningDate, exitDate } = {}) {
  const { start, end } = monthRange(month);
  const joined = dayKeyOrNull(joiningDate);
  const exited = dayKeyOrNull(exitDate);
  const from = joined && joined > start ? joined : start;
  const to = exited && exited < end ? exited : end;
  if (from > to) return null;
  return { from, to, monthStart: start, monthEnd: end };
}

// Computes one employee's payroll for a month.
//
//   computePayroll({
//     salary: { basic, hra, allowances, deductions },   // monthly structure
//     month: 'YYYY-MM',
//     joiningDate, exitDate,                            // Date | null
//     calendar,                                         // utils/workingDays.buildCalendar()
//     policy: { proRataBasis: 'none'|'calendar'|'working', deductUnpaidLeave: bool },
//     unpaidLeaveDays,                                  // approved unpaid-leave working days inside the window
//   })
//
// Policy semantics (an explicit organization setting — see Organization
// model — never a silent assumption):
//   none      full monthly salary; days are recorded for information only.
//   calendar  every component x payableDays / calendar days in the month.
//   working   every component x payableDays / working days in the month.
// payableDays = days employed in the month (in the chosen basis) minus
// unpaid-leave days when deductUnpaidLeave is on. Unpaid leave is always
// counted in working days because that is the unit leave requests are
// charged in; under the calendar basis this slightly favours the employee
// (a documented choice, not an accident).
//
// All four components (including deductions) scale by the same factor, so
// a deduction expressed as a monthly amount (PF, insurance) is pro-rated
// alongside the earnings it relates to.
function computePayroll({ salary, month, joiningDate = null, exitDate = null, calendar, policy = {}, unpaidLeaveDays = 0 }) {
  const window = employmentWindow(month, { joiningDate, exitDate });
  if (!window) return null;

  const basis = policy.proRataBasis || 'none';
  const deductUnpaid = Boolean(policy.deductUnpaidLeave) && basis !== 'none';

  const monthCalendarDays = countCalendarDays(window.monthStart, window.monthEnd);
  const monthWorkingDays = calendar ? countWorkingDays(window.monthStart, window.monthEnd, calendar) : null;
  const employedCalendarDays = countCalendarDays(window.from, window.to);
  const employedWorkingDays = calendar ? countWorkingDays(window.from, window.to, calendar) : null;

  let totalDays;
  let employedDays;
  if (basis === 'working') {
    totalDays = monthWorkingDays;
    employedDays = employedWorkingDays;
  } else {
    totalDays = monthCalendarDays;
    employedDays = employedCalendarDays;
  }

  const unpaid = deductUnpaid ? Math.max(0, Math.min(Number(unpaidLeaveDays) || 0, employedDays)) : 0;
  const payableDays = basis === 'none' ? employedDays : Math.max(0, employedDays - unpaid);
  const factor = basis === 'none' || totalDays === 0 ? 1 : payableDays / totalDays;

  const scale = (value) => roundMoney(Number(value || 0) * factor);
  const components = {
    basic: scale(salary.basic),
    hra: scale(salary.hra),
    allowances: scale(salary.allowances),
    deductions: scale(salary.deductions),
  };

  return {
    ...components,
    grossSalary: calculateGrossSalary(components),
    netSalary: calculateNetSalary(components),
    period: {
      from: window.from,
      to: window.to,
      basis,
      totalDays,
      employedDays,
      unpaidLeaveDays: unpaid,
      payableDays,
      // 6 dp so the payslip can show "26 / 31" and the factor agrees with
      // the rounded components to the cent.
      factor: Math.round(factor * 1e6) / 1e6,
      monthCalendarDays,
      monthWorkingDays,
    },
  };
}

module.exports = { roundMoney, calculateGrossSalary, calculateNetSalary, employmentWindow, computePayroll };
