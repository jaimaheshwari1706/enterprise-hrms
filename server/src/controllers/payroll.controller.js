const { Salary, Payroll, Employee, User } = require('../models');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { sendPayrollGeneratedEmail } = require('../services/emailService');
const ApiError = require('../utils/ApiError');

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
  const salary = await Salary.findOne({ employee: req.params.employeeId });
  return ok(res, { message: 'Salary details', data: salary });
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

// POST /api/payroll/generate  (HR_ADMIN, SUPER_ADMIN)
// body: { month: 'YYYY-MM', employeeId?: string }
// Generates Draft payroll records from each employee's configured Salary.
// Existing records for that employee+month are left untouched (not
// overwritten) so an already-Processed/Paid payroll can't be clobbered by
// re-running generation.
const generatePayroll = asyncHandler(async (req, res) => {
  const { month, employeeId } = req.body;

  const employees = employeeId
    ? await Employee.find({ _id: employeeId, status: 'active' })
    : await Employee.find({ status: 'active' });

  if (employees.length === 0) {
    throw new ApiError(404, 'No active employees found to generate payroll for');
  }

  const generated = [];
  const skipped = [];

  for (const employee of employees) {
    const existing = await Payroll.findOne({ employee: employee._id, month });
    if (existing) {
      skipped.push({ employee: `${employee.firstName} ${employee.lastName}`, reason: 'Already generated for this month' });
      continue;
    }

    const salary = await Salary.findOne({ employee: employee._id });
    if (!salary) {
      skipped.push({ employee: `${employee.firstName} ${employee.lastName}`, reason: 'No salary structure configured' });
      continue;
    }

    const grossSalary = salary.basic + salary.hra + salary.allowances;
    const netSalary = grossSalary - salary.deductions;

    const payroll = await Payroll.create({
      employee: employee._id,
      month,
      basic: salary.basic,
      hra: salary.hra,
      allowances: salary.allowances,
      deductions: salary.deductions,
      grossSalary,
      netSalary,
      status: 'Draft',
    });
    generated.push(payroll);

    if (employee.user) {
      const user = await User.findById(employee.user);
      if (user) {
        await notify({
          user: user._id,
          title: 'Payroll generated',
          message: `Your payroll for ${month} has been generated. Net salary: ${netSalary}`,
          type: 'PAYROLL',
          link: '/payroll',
        });
        await sendPayrollGeneratedEmail(user.email, month, netSalary);
      }
    }
  }

  await logAction({
    user: req.user,
    action: 'GENERATE_PAYROLL',
    entityType: 'Payroll',
    description: `Generated payroll for ${month} — ${generated.length} created, ${skipped.length} skipped`,
    ip: req.ip,
  });

  await getRedisClient().del('dashboard:hr');

  return created(res, {
    message: `Payroll generated for ${generated.length} employee(s)`,
    data: { generated, skipped },
  });
});

// GET /api/payroll?page=&limit=&month=&employee=&status=  (HR_ADMIN, SUPER_ADMIN)
const listPayroll = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { month, employee, status } = req.query;

  const filter = {};
  if (month) filter.month = month;
  if (employee) filter.employee = employee;
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    Payroll.find(filter)
      .populate('employee', 'firstName lastName employeeId profileImageUrl')
      .sort({ month: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payroll.countDocuments(filter),
  ]);

  return ok(res, { message: 'Payroll records', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/payroll/me?page=&limit=
const getMyPayroll = asyncHandler(async (req, res) => {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  const { page, limit, skip } = getPagination(req.query);

  const filter = { employee: req.user.employee._id, status: { $ne: 'Draft' } };

  const [data, total] = await Promise.all([
    Payroll.find(filter).sort({ month: -1 }).skip(skip).limit(limit),
    Payroll.countDocuments(filter),
  ]);

  return ok(res, { message: 'My payroll records', data, pagination: buildPaginationMeta(page, limit, total) });
});

// PATCH /api/payroll/:id/status  (HR_ADMIN, SUPER_ADMIN)
const updatePayrollStatus = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) throw new ApiError(404, 'Payroll record not found');

  payroll.status = req.body.status;
  await payroll.save();

  await logAction({
    user: req.user,
    action: 'UPDATE_PAYROLL_STATUS',
    entityType: 'Payroll',
    entityId: payroll._id,
    description: `Marked payroll for ${payroll.month} as ${payroll.status}`,
    ip: req.ip,
  });

  return ok(res, { message: 'Payroll status updated', data: payroll });
});

module.exports = {
  getSalary,
  updateSalary,
  generatePayroll,
  listPayroll,
  getMyPayroll,
  updatePayrollStatus,
};
