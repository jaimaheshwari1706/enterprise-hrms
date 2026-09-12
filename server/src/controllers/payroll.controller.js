const { Salary, Payroll, Employee, User, LeaveRequest, Organization, Counter } = require('../models');
const { calculateGrossSalary, calculateNetSalary, computePayroll, employmentWindow } = require('../utils/payrollCalculations');
const { countWorkingDays, monthRange } = require('../utils/workingDays');
const { startOfDay, monthString } = require('../utils/dateHelpers');
const { getWorkingCalendar } = require('../services/calendarService');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta, getSort } = require('../utils/pagination');
const { containsRegex } = require('../utils/regex');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { sendPayrollGeneratedEmail } = require('../services/emailService');
const { PAYROLL_SORT_FIELDS } = require('../validations/payroll.validation');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

// Payroll moves forward only: a Paid record can never silently regress to
// Draft (which would let it be regenerated/paid twice).
const STATUS_TRANSITIONS = { Draft: 'Processed', Processed: 'Paid' };

function isHR(req) {
  return ['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
}

// Employees may only ever look at their own salary/payroll; HR/Admin can
// look at anyone's. Centralized here so every endpoint below stays honest.
function assertCanAccessEmployee(req, employeeId) {
  if (isHR(req)) return;
  if (req.user.employee?._id?.toString() === employeeId) return;
  throw new ApiError(403, 'You can only view your own salary and payroll information');
}

// GET /api/payroll/salary/:employeeId
const getSalary = asyncHandler(async (req, res) => {
  assertCanAccessEmployee(req, req.params.employeeId);
  const salary = await Salary.findOne({ employee: req.params.employeeId }).lean();
  return ok(res, { message: 'Salary details', data: salary });
});

// GET /api/payroll/salaries?page=&limit=&search=&missing=true  (HR_ADMIN, SUPER_ADMIN)
// Salary structure per active employee, paginated and searchable so the
// "Salary Configuration" tab stays usable with thousands of employees.
// `missing=true` narrows to employees with no structure yet (they would be
// skipped by payroll generation). `meta.missing` is the org-wide count.
const listSalaries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search, missing } = req.query;

  // Ids with a structure — one small query (one ObjectId per structure)
  // that powers both the "missing only" filter and the org-wide count.
  const withSalary = await Salary.find().distinct('employee');
  const filter = { status: 'active' };
  if (search) {
    const regex = containsRegex(search);
    filter.$or = [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }];
  }
  if (missing === 'true') filter._id = { $nin: withSalary };

  const [employees, total, missingCount] = await Promise.all([
    Employee.find(filter)
      .select('firstName lastName employeeId profileImageUrl department designation')
      .populate('department', 'name')
      .populate('designation', 'name')
      .sort({ firstName: 1, lastName: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Employee.countDocuments(filter),
    Employee.countDocuments({ status: 'active', _id: { $nin: withSalary } }),
  ]);
  const salaries = await Salary.find({ employee: { $in: employees.map((e) => e._id) } }).lean();
  const byEmployee = new Map(salaries.map((s) => [s.employee.toString(), s]));

  const data = employees.map((employee) => {
    const salary = byEmployee.get(employee._id.toString()) || null;
    return {
      employee,
      salary,
      grossSalary: salary ? calculateGrossSalary(salary) : null,
      netSalary: salary ? calculateNetSalary(salary) : null,
    };
  });

  return ok(res, { message: 'Salary structures', data, pagination: buildPaginationMeta(page, limit, total), meta: { missing: missingCount } });
});

// PUT /api/payroll/salary/:employeeId  (HR_ADMIN, SUPER_ADMIN)
const updateSalary = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.employeeId);
  if (!employee) throw new ApiError(404, 'Employee not found');

  const salary = await Salary.findOneAndUpdate(
    { employee: employee._id },
    { ...req.body, effectiveFrom: new Date() },
    { new: true, upsert: true, runValidators: true }
  );

  await logAction({
    user: req.user,
    action: 'UPDATE_SALARY',
    entityType: 'Salary',
    entityId: salary._id,
    description: `Updated salary structure for ${employee.firstName} ${employee.lastName}`,
    ip: req.ip,
  });

  return ok(res, { message: 'Salary updated successfully', data: salary });
});

// Approved *unpaid* leave, in working days, per employee, clipped to each
// employee's employment window inside the month. Only computed when the
// policy actually deducts unpaid leave.
async function unpaidLeaveDaysByEmployee(employees, month, calendar, windows) {
  const { start, end } = monthRange(month);
  const requests = await LeaveRequest.find({
    employee: { $in: employees.map((e) => e._id) },
    status: 'Approved',
    startDate: { $lte: end },
    endDate: { $gte: start },
  })
    .populate('leaveType', 'isPaid')
    .select('employee startDate endDate leaveType')
    .lean();

  const totals = new Map();
  for (const request of requests) {
    if (request.leaveType?.isPaid !== false) continue;
    const window = windows.get(request.employee.toString());
    if (!window) continue;
    const from = request.startDate > window.from ? startOfDay(request.startDate, 'UTC') : window.from;
    const to = request.endDate < window.to ? startOfDay(request.endDate, 'UTC') : window.to;
    if (from > to) continue;
    const key = request.employee.toString();
    totals.set(key, (totals.get(key) || 0) + countWorkingDays(from, to, calendar));
  }
  return totals;
}

// Reserves `count` sequential payslip numbers for a month in one atomic
// $inc, e.g. PS-202609-0001 … PS-202609-0025.
async function reservePayslipNumbers(month, count) {
  if (count === 0) return [];
  const counter = await Counter.findOneAndUpdate(
    { _id: `payslip:${month}` },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );
  const first = counter.seq - count + 1;
  return Array.from({ length: count }, (_, i) => `PS-${month.replace('-', '')}-${String(first + i).padStart(4, '0')}`);
}

// POST /api/payroll/generate  (HR_ADMIN, SUPER_ADMIN)
// body: { month: 'YYYY-MM', employeeId?: string }
// Generates Draft payroll records from each employee's configured Salary,
// applying the organization's pro-rata policy (joining/exit dates, unpaid
// leave). Existing records for that employee+month are left untouched (not
// overwritten) so an already-Processed/Paid payroll can't be clobbered by
// re-running generation. Everything is batch-loaded and inserted in one
// insertMany.
const generatePayroll = asyncHandler(async (req, res) => {
  const { month, employeeId } = req.body;

  // Leave and attendance for a month aren't final until it ends, and an
  // arbitrarily distant month would produce meaningless records.
  if (month > monthString()) {
    throw new ApiError(400, 'Payroll can only be generated for the current or a past month', null, 'PAYROLL_FUTURE_MONTH');
  }

  const { start: monthStart, end: monthEnd } = monthRange(month);
  // Active employees, plus anyone who left during (or after) this month —
  // a leaver's final month is still payable.
  const employeeFilter = {
    ...(employeeId ? { _id: employeeId } : {}),
    $or: [{ status: 'active' }, { status: 'inactive', exitDate: { $gte: monthStart } }],
  };
  const employees = await Employee.find(employeeFilter).select('firstName lastName employeeId user joiningDate exitDate status').lean();

  if (employees.length === 0) {
    throw new ApiError(404, 'No employees are eligible for payroll in this month');
  }

  const employeeIds = employees.map((e) => e._id);
  const [{ calendar, payrollPolicy }, existingRows, salaryRows] = await Promise.all([
    getWorkingCalendar(),
    Payroll.find({ employee: { $in: employeeIds }, month }).select('employee').lean(),
    Salary.find({ employee: { $in: employeeIds } }).lean(),
  ]);
  const alreadyGenerated = new Set(existingRows.map((p) => p.employee.toString()));
  const salaryByEmployee = new Map(salaryRows.map((s) => [s.employee.toString(), s]));

  // Employment window per employee (null = not employed during the month).
  const windows = new Map();
  for (const employee of employees) {
    const window = employmentWindow(month, employee);
    if (window) windows.set(employee._id.toString(), window);
  }
  const unpaidByEmployee = payrollPolicy.deductUnpaidLeave
    ? await unpaidLeaveDaysByEmployee(employees, month, calendar, windows)
    : new Map();

  const toInsert = [];
  const skipped = [];

  for (const employee of employees) {
    const name = `${employee.firstName} ${employee.lastName}`;
    const key = employee._id.toString();
    if (alreadyGenerated.has(key)) {
      skipped.push({ employee: name, reason: 'Already generated for this month' });
      continue;
    }
    if (!windows.has(key)) {
      const joinedLater = startOfDay(employee.joiningDate, 'UTC') > monthEnd;
      skipped.push({ employee: name, reason: joinedLater ? 'Joined after this month' : 'Left before this month' });
      continue;
    }
    const salary = salaryByEmployee.get(key);
    if (!salary) {
      skipped.push({ employee: name, reason: 'No salary structure configured' });
      continue;
    }
    const computed = computePayroll({
      salary,
      month,
      joiningDate: employee.joiningDate,
      exitDate: employee.exitDate,
      calendar,
      policy: payrollPolicy,
      unpaidLeaveDays: unpaidByEmployee.get(key) || 0,
    });
    toInsert.push({
      employee: employee._id,
      month,
      ...computed,
      status: 'Draft',
      generatedBy: req.user._id,
    });
  }

  let generated = [];
  if (toInsert.length) {
    const numbers = await reservePayslipNumbers(month, toInsert.length);
    toInsert.forEach((row, i) => {
      row.payslipNumber = numbers[i];
    });
    // ordered:false — if two HR users click Generate simultaneously the
    // unique (employee, month) index rejects the duplicates individually
    // while still inserting the rest.
    try {
      generated = await Payroll.insertMany(toInsert, { ordered: false });
    } catch (err) {
      if (err.code !== 11000 && !err.writeErrors) throw err;
      generated = err.insertedDocs || [];
      logger.warn('Some payroll rows already existed during generation', { month, requestId: req.id });
    }
  }

  // Notify employees whose payroll was created. Emails are best-effort.
  const userIds = employees.filter((e) => e.user).map((e) => e.user);
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('email').lean() : [];
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const employeeById = new Map(employees.map((e) => [e._id.toString(), e]));

  for (const payroll of generated) {
    const employee = employeeById.get(payroll.employee.toString());
    const user = employee?.user ? userById.get(employee.user.toString()) : null;
    if (!user) continue;
    await notify({
      user: user._id,
      title: 'Payroll generated',
      message: `Your payroll for ${month} has been generated. Net salary: ${payroll.netSalary}`,
      type: 'PAYROLL',
      link: '/payroll',
    });
    try {
      await sendPayrollGeneratedEmail(user.email, month, payroll.netSalary);
    } catch (err) {
      logger.error('Payroll email failed to send', { userId: user._id.toString(), error: err, requestId: req.id });
    }
  }

  await logAction({
    user: req.user,
    action: 'GENERATE_PAYROLL',
    entityType: 'Payroll',
    description: `Generated payroll for ${month} — ${generated.length} created, ${skipped.length} skipped (pro-rata: ${payrollPolicy.proRataBasis})`,
    ip: req.ip,
  });

  await getRedisClient().del('dashboard:hr');

  return created(res, {
    message: `Payroll generated for ${generated.length} employee(s)`,
    data: { generated, skipped },
    meta: { policy: payrollPolicy },
  });
});

// GET /api/payroll?page=&limit=&sort=&month=&employee=&status=  (HR_ADMIN, SUPER_ADMIN)
const listPayroll = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, PAYROLL_SORT_FIELDS, { month: -1, createdAt: -1 });
  const { month, employee, status } = req.query;

  const filter = {};
  if (month) filter.month = month;
  if (employee) filter.employee = employee;
  if (status) filter.status = status;

  const [data, total, totalsAgg] = await Promise.all([
    Payroll.find(filter)
      .populate('employee', 'firstName lastName employeeId profileImageUrl')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Payroll.countDocuments(filter),
    // Totals for the current filter — lets the UI show "₹X across N
    // records" without a second request.
    Payroll.aggregate([
      { $match: filter },
      { $group: { _id: null, gross: { $sum: '$grossSalary' }, net: { $sum: '$netSalary' }, deductions: { $sum: '$deductions' } } },
    ]),
  ]);

  const totals = totalsAgg[0] ? { gross: totalsAgg[0].gross, net: totalsAgg[0].net, deductions: totalsAgg[0].deductions } : { gross: 0, net: 0, deductions: 0 };

  return ok(res, {
    message: 'Payroll records',
    data,
    pagination: buildPaginationMeta(page, limit, total),
    meta: { totals },
  });
});

// GET /api/payroll/me?page=&limit=
const getMyPayroll = asyncHandler(async (req, res) => {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ['month', 'netSalary'], { month: -1 });

  const filter = { employee: req.user.employee._id, status: { $ne: 'Draft' } };

  const [data, total] = await Promise.all([
    Payroll.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Payroll.countDocuments(filter),
  ]);

  return ok(res, { message: 'My payroll records', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/payroll/:id  — full payslip detail.
// HR can open any record; an employee only their own, and only once it has
// left Draft (a Draft is HR's working copy, not a statement to the employee).
const getPayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id)
    .populate({
      path: 'employee',
      select: 'firstName lastName employeeId email joiningDate profileImageUrl department designation',
      populate: [
        { path: 'department', select: 'name' },
        { path: 'designation', select: 'name' },
      ],
    })
    .lean();
  if (!payroll) throw new ApiError(404, 'Payroll record not found');

  const employeeId = payroll.employee?._id?.toString();
  if (!isHR(req)) {
    // Same 404 for "not yours" and "doesn't exist" so ids can't be probed.
    if (!employeeId || req.user.employee?._id?.toString() !== employeeId) {
      throw new ApiError(404, 'Payroll record not found');
    }
    if (payroll.status === 'Draft') throw new ApiError(404, 'Payroll record not found');
  }

  const organization = await Organization.findOne().select('name logoUrl address email phone').lean();
  return ok(res, { message: 'Payroll details', data: { ...payroll, organization } });
});

// PATCH /api/payroll/:id/status  (HR_ADMIN, SUPER_ADMIN)
const updatePayrollStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const existing = await Payroll.findById(req.params.id).select('status month').lean();
  if (!existing) throw new ApiError(404, 'Payroll record not found');

  if (status === existing.status) {
    throw new ApiError(409, `Payroll is already ${status}`);
  }
  if (STATUS_TRANSITIONS[existing.status] !== status) {
    throw new ApiError(
      409,
      `Payroll can only move from ${existing.status} to ${STATUS_TRANSITIONS[existing.status] || 'nowhere (it is final)'}`,
      null,
      'INVALID_TRANSITION'
    );
  }

  // Conditional update: the status we read must still be current.
  const stamp = status === 'Processed' ? { processedAt: new Date() } : { paidAt: new Date() };
  const payroll = await Payroll.findOneAndUpdate(
    { _id: existing._id, status: existing.status },
    { status, ...stamp },
    { new: true }
  );
  if (!payroll) throw new ApiError(409, 'Payroll status was changed by someone else. Please refresh.');

  await logAction({
    user: req.user,
    action: 'UPDATE_PAYROLL_STATUS',
    entityType: 'Payroll',
    entityId: payroll._id,
    description: `Marked payroll for ${payroll.month} as ${payroll.status}`,
    ip: req.ip,
  });

  await getRedisClient().del('dashboard:hr');
  return ok(res, { message: 'Payroll status updated', data: payroll });
});

module.exports = {
  getSalary,
  listSalaries,
  updateSalary,
  generatePayroll,
  listPayroll,
  getMyPayroll,
  getPayroll,
  updatePayrollStatus,
};
