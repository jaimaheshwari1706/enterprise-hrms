const { LeaveType, LeaveRequest, Approval, Employee, User, Attendance } = require('../models');
const { startOfDay, endOfDay, startOfYear, toDateString } = require('../utils/dateHelpers');
const { summarizeLeaveRange } = require('../utils/leaveCalculations');
const { listWorkingDays } = require('../utils/workingDays');
const { getWorkingCalendar } = require('../services/calendarService');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta, getSort } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { sendLeaveSubmittedEmail, sendLeaveStatusEmail } = require('../services/emailService');
const { LEAVE_SORT_FIELDS } = require('../validations/leave.validation');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

function requireEmployeeProfile(req) {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  return req.user.employee;
}

// Finds everyone who should be notified/emailed about a pending request:
// the employee's manager if they have one, otherwise every active
// HR_ADMIN/SUPER_ADMIN — matching the Module 8 fallback rule.
async function getApprovers(employee) {
  if (employee.manager) {
    const manager = await Employee.findById(employee.manager).populate('user');
    if (manager?.user) return [{ employeeId: manager._id, user: manager.user }];
  }
  const hrUsers = await User.find({ role: { $in: ['HR_ADMIN', 'SUPER_ADMIN'] }, isActive: true });
  return hrUsers.map((u) => ({ employeeId: null, user: u }));
}

// Email/notification fan-out never blocks or fails the request that
// triggered it — a down SMTP server must not stop a leave from being filed.
async function safely(label, fn, meta = {}) {
  try {
    await fn();
  } catch (err) {
    logger.error(`${label} failed`, { ...meta, error: err });
  }
}

// Days already consumed (Approved) or reserved (Pending) for a leave type
// in the current business year. Pending requests count so an employee
// can't file several requests that individually fit but collectively
// exceed the allowance.
async function usedDaysThisYear(employeeId, leaveTypeId) {
  const [row] = await LeaveRequest.aggregate([
    {
      $match: {
        employee: employeeId,
        leaveType: leaveTypeId,
        status: { $in: ['Approved', 'Pending'] },
        startDate: { $gte: startOfYear() },
      },
    },
    { $group: { _id: null, days: { $sum: '$days' } } },
  ]);
  return row?.days || 0;
}

// GET /api/leaves/leave-types
const listLeaveTypes = asyncHandler(async (req, res) => {
  const leaveTypes = await LeaveType.find().sort({ name: 1 }).lean();
  return ok(res, { message: 'Leave types', data: leaveTypes });
});

// POST /api/leaves/leave-types  (HR_ADMIN, SUPER_ADMIN)
const createLeaveType = asyncHandler(async (req, res) => {
  const exists = await LeaveType.findOne({ name: req.body.name }).lean();
  if (exists) throw new ApiError(409, 'A leave type with this name already exists');
  const leaveType = await LeaveType.create(req.body);
  await logAction({
    user: req.user,
    action: 'CREATE_LEAVE_TYPE',
    entityType: 'LeaveType',
    entityId: leaveType._id,
    description: `Created leave type ${leaveType.name}`,
    ip: req.ip,
  });
  return created(res, { message: 'Leave type created', data: leaveType });
});

// PUT /api/leaves/leave-types/:id  (HR_ADMIN, SUPER_ADMIN)
// Allocation / paid-flag changes apply to future requests; days already
// charged on existing requests are never recomputed.
const updateLeaveType = asyncHandler(async (req, res) => {
  if (req.body.name) {
    const clash = await LeaveType.findOne({ name: req.body.name, _id: { $ne: req.params.id } }).lean();
    if (clash) throw new ApiError(409, 'A leave type with this name already exists');
  }
  const leaveType = await LeaveType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!leaveType) throw new ApiError(404, 'Leave type not found');
  await logAction({
    user: req.user,
    action: 'UPDATE_LEAVE_TYPE',
    entityType: 'LeaveType',
    entityId: leaveType._id,
    description: `Updated leave type ${leaveType.name}`,
    ip: req.ip,
  });
  return ok(res, { message: 'Leave type updated', data: leaveType });
});

// GET /api/leaves/preview?startDate=&endDate=
// How many working days a range would be charged, so the leave form shows
// the same number the server will store (weekends/holidays excluded).
const previewLeaveDays = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startOfDay(`${startDate}T00:00:00Z`, 'UTC');
  const end = startOfDay(`${endDate}T00:00:00Z`, 'UTC');
  if (end < start) throw new ApiError(400, 'End date cannot be before start date');
  const { calendar } = await getWorkingCalendar();
  return ok(res, { message: 'Leave day preview', data: summarizeLeaveRange(start, end, calendar) });
});

// POST /api/leaves/apply
const applyLeave = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);
  const { leaveType, startDate, endDate, reason } = req.body;

  const type = await LeaveType.findById(leaveType);
  if (!type) throw new ApiError(404, 'Leave type not found');

  // Date-only strings are interpreted as business calendar days (UTC
  // midnight keys — see dateHelpers).
  const start = startOfDay(`${startDate}T00:00:00Z`, 'UTC');
  const end = startOfDay(`${endDate}T00:00:00Z`, 'UTC');
  if (end < start) throw new ApiError(400, 'End date cannot be before start date');

  // Charge only working days: weekends and holidays inside the range are
  // not leave, per the organization's calendar.
  const { calendar } = await getWorkingCalendar();
  const days = summarizeLeaveRange(start, end, calendar).days;
  if (days === 0) {
    throw new ApiError(
      400,
      'The selected dates contain no working days (weekends and holidays are not counted as leave)',
      null,
      'LEAVE_NO_WORKING_DAYS'
    );
  }

  // Overlap: any live (Pending/Approved) request whose range intersects.
  const overlapping = await LeaveRequest.findOne({
    employee: employee._id,
    status: { $in: ['Pending', 'Approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  })
    .populate('leaveType', 'name')
    .lean();
  if (overlapping) {
    throw new ApiError(
      409,
      `You already have a ${overlapping.status.toLowerCase()} ${overlapping.leaveType?.name || 'leave'} request from ${toDateString(overlapping.startDate, 'UTC')} to ${toDateString(overlapping.endDate, 'UTC')} that overlaps these dates`,
      null,
      'LEAVE_OVERLAP'
    );
  }

  // Balance: allocation minus what's approved or awaiting approval this year.
  const used = await usedDaysThisYear(employee._id, type._id);
  const remaining = type.defaultDaysPerYear - used;
  if (days > remaining) {
    throw new ApiError(
      409,
      remaining > 0
        ? `Only ${remaining} ${type.name} day${remaining === 1 ? '' : 's'} remaining this year (this request needs ${days})`
        : `You have no ${type.name} days remaining this year`,
      null,
      'LEAVE_BALANCE_EXCEEDED'
    );
  }

  const leaveRequest = await LeaveRequest.create({
    employee: employee._id,
    leaveType: type._id,
    startDate: start,
    endDate: end,
    days,
    reason,
    status: 'Pending',
  });

  const approvers = await getApprovers(employee);
  const approverEmployeeId = approvers[0]?.employeeId || null;

  await Approval.create({
    requestType: 'LEAVE',
    requestId: leaveRequest._id,
    requestedBy: employee._id,
    approver: approverEmployeeId,
    status: 'Pending',
  });

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const startLabel = toDateString(start, 'UTC');
  const endLabel = toDateString(end, 'UTC');
  for (const { user } of approvers) {
    await notify({
      user: user._id,
      title: 'New leave request',
      message: `${employeeName} requested ${type.name} from ${startLabel} to ${endLabel}`,
      type: 'LEAVE',
      link: `/leaves/approvals`,
    });
    await safely(
      'Leave submitted email',
      () => sendLeaveSubmittedEmail(user.email, employeeName, type.name, startLabel, endLabel),
      { requestId: req.id }
    );
  }

  await logAction({
    user: req.user,
    action: 'APPLY_LEAVE',
    entityType: 'LeaveRequest',
    entityId: leaveRequest._id,
    description: `${employeeName} applied for ${type.name} (${days} day${days > 1 ? 's' : ''})`,
    ip: req.ip,
  });

  const populated = await leaveRequest.populate('leaveType');
  await getRedisClient().del('dashboard:hr');
  return created(res, { message: 'Leave request submitted successfully', data: populated });
});

// GET /api/leaves/me?page=&limit=&sort=&status=
const getMyLeaves = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, LEAVE_SORT_FIELDS, { createdAt: -1 });
  const { status } = req.query;

  const filter = { employee: employee._id };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    LeaveRequest.find(filter).populate('leaveType').sort(sort).skip(skip).limit(limit).lean(),
    LeaveRequest.countDocuments(filter),
  ]);

  return ok(res, { message: 'My leave requests', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/leaves/me/balance — per-type allocation / used / pending / remaining
const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);

  const [leaveTypes, usage] = await Promise.all([
    LeaveType.find().sort({ name: 1 }).lean(),
    LeaveRequest.aggregate([
      {
        $match: {
          employee: employee._id,
          status: { $in: ['Approved', 'Pending'] },
          startDate: { $gte: startOfYear() },
        },
      },
      { $group: { _id: { leaveType: '$leaveType', status: '$status' }, days: { $sum: '$days' } } },
    ]),
  ]);

  const byType = {};
  for (const row of usage) {
    const key = row._id.leaveType.toString();
    byType[key] = byType[key] || { used: 0, pending: 0 };
    if (row._id.status === 'Approved') byType[key].used += row.days;
    else byType[key].pending += row.days;
  }

  const data = leaveTypes.map((type) => {
    const u = byType[type._id.toString()] || { used: 0, pending: 0 };
    return {
      leaveTypeId: type._id,
      leaveType: type.name,
      allocated: type.defaultDaysPerYear,
      used: u.used,
      pending: u.pending,
      remaining: Math.max(0, type.defaultDaysPerYear - u.used - u.pending),
    };
  });

  return ok(res, { message: 'Leave balance', data });
});

// PATCH /api/leaves/:id/cancel
const cancelLeave = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);
  const existing = await LeaveRequest.findById(req.params.id).select('employee status').lean();

  if (!existing) throw new ApiError(404, 'Leave request not found');
  if (existing.employee.toString() !== employee._id.toString()) {
    throw new ApiError(403, 'You can only cancel your own leave requests');
  }

  // Atomic: only a still-Pending request can flip to Cancelled.
  const leaveRequest = await LeaveRequest.findOneAndUpdate(
    { _id: existing._id, status: 'Pending' },
    { status: 'Cancelled' },
    { new: true }
  );
  if (!leaveRequest) throw new ApiError(409, 'Only pending leave requests can be cancelled');

  await Approval.findOneAndUpdate(
    { requestType: 'LEAVE', requestId: leaveRequest._id, status: 'Pending' },
    { status: 'Rejected', comment: 'Automatically closed — cancelled by the employee', actionDate: new Date() }
  );

  await logAction({
    user: req.user,
    action: 'CANCEL_LEAVE',
    entityType: 'LeaveRequest',
    entityId: leaveRequest._id,
    description: `${employee.firstName} ${employee.lastName} cancelled a pending leave request`,
    ip: req.ip,
  });

  await getRedisClient().del('dashboard:hr');
  return ok(res, { message: 'Leave request cancelled', data: leaveRequest });
});

// GET /api/leaves?page=&limit=&sort=&status=&employee=&from=&to=  (HR_ADMIN, SUPER_ADMIN, MANAGER)
const listLeaveRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, LEAVE_SORT_FIELDS, { createdAt: -1 });
  const { status, employee, from, to } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;
  if (from) filter.endDate = { $gte: startOfDay(`${from}T00:00:00Z`, 'UTC') };
  if (to) filter.startDate = { $lte: endOfDay(`${to}T00:00:00Z`, 'UTC') };

  if (req.user.role === 'MANAGER') {
    const teamIds = (await Employee.find({ manager: req.user.employee?._id }).distinct('_id')).map(String);
    if (employee && !teamIds.includes(employee)) {
      throw new ApiError(403, 'You can only view leave requests for your own team');
    }
    filter.employee = employee || { $in: teamIds };
  }

  const [data, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate('leaveType')
      .populate('employee', 'firstName lastName employeeId profileImageUrl manager')
      .populate('approver', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    LeaveRequest.countDocuments(filter),
  ]);

  return ok(res, { message: 'Leave requests', data, pagination: buildPaginationMeta(page, limit, total) });
});

// Shared authorization + core logic for approve/reject.
async function resolveLeaveDecision(req, decision) {
  const existing = await LeaveRequest.findById(req.params.id).populate('employee').lean();
  if (!existing) throw new ApiError(404, 'Leave request not found');
  if (existing.status !== 'Pending') {
    throw new ApiError(409, 'This leave request has already been actioned');
  }

  const approverEmployee = req.user.employee;
  const isDirectManager =
    approverEmployee && existing.employee.manager?.toString() === approverEmployee._id.toString();
  const isHRFallback = ['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

  if (!isDirectManager && !isHRFallback) {
    throw new ApiError(403, 'You are not authorized to act on this leave request');
  }
  if (approverEmployee && existing.employee._id.toString() === approverEmployee._id.toString()) {
    throw new ApiError(403, 'You cannot approve or reject your own leave request');
  }

  const comment = req.body.comment || '';

  // Atomic transition: whichever of two concurrent approvers runs this
  // update first wins; the other sees no match and gets a 409 instead of
  // sending a second round of emails/notifications.
  const leaveRequest = await LeaveRequest.findOneAndUpdate(
    { _id: existing._id, status: 'Pending' },
    { status: decision, approver: approverEmployee?._id || null, approverComment: comment },
    { new: true }
  )
    .populate('employee')
    .populate('leaveType');
  if (!leaveRequest) throw new ApiError(409, 'This leave request has already been actioned');

  await Approval.findOneAndUpdate(
    { requestType: 'LEAVE', requestId: leaveRequest._id, status: 'Pending' },
    {
      status: decision,
      approver: approverEmployee?._id || null,
      comment,
      actionDate: new Date(),
    }
  );

  // Reusing the Attendance model here: approved leave days are marked with
  // status='Leave' so attendance reports and the dashboard automatically
  // reflect who's on leave, without any extra bookkeeping. Only working
  // days are marked — a weekend or holiday inside the range is not a leave
  // day and must not show up as one in attendance reports.
  if (decision === 'Approved') {
    const { calendar } = await getWorkingCalendar();
    const ops = listWorkingDays(
      startOfDay(leaveRequest.startDate, 'UTC'),
      startOfDay(leaveRequest.endDate, 'UTC'),
      calendar
    ).map((day) => ({
      updateOne: {
        filter: { employee: leaveRequest.employee._id, date: day },
        update: { $set: { status: 'Leave' } },
        upsert: true,
      },
    }));
    if (ops.length) await Attendance.bulkWrite(ops, { ordered: false });
  }

  if (leaveRequest.employee.user) {
    const employeeUser = await User.findById(leaveRequest.employee.user);
    if (employeeUser) {
      await notify({
        user: employeeUser._id,
        title: `Leave ${decision.toLowerCase()}`,
        message: `Your ${leaveRequest.leaveType.name} request has been ${decision.toLowerCase()}`,
        type: 'LEAVE',
        link: '/leaves',
      });
      await safely(
        'Leave status email',
        () =>
          sendLeaveStatusEmail(
            employeeUser.email,
            decision,
            leaveRequest.leaveType.name,
            toDateString(leaveRequest.startDate, 'UTC'),
            toDateString(leaveRequest.endDate, 'UTC'),
            leaveRequest.approverComment
          ),
        { requestId: req.id }
      );
    }
  }

  await logAction({
    user: req.user,
    action: decision === 'Approved' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
    entityType: 'LeaveRequest',
    entityId: leaveRequest._id,
    description: `${decision} leave request for ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
    ip: req.ip,
  });

  await getRedisClient().del('dashboard:hr');

  return leaveRequest;
}

// PATCH /api/leaves/:id/approve
const approveLeave = asyncHandler(async (req, res) => {
  const leaveRequest = await resolveLeaveDecision(req, 'Approved');
  return ok(res, { message: 'Leave request approved', data: leaveRequest });
});

// PATCH /api/leaves/:id/reject
const rejectLeave = asyncHandler(async (req, res) => {
  const leaveRequest = await resolveLeaveDecision(req, 'Rejected');
  return ok(res, { message: 'Leave request rejected', data: leaveRequest });
});

module.exports = {
  listLeaveTypes,
  createLeaveType,
  updateLeaveType,
  previewLeaveDays,
  applyLeave,
  getMyLeaves,
  getMyLeaveBalance,
  cancelLeave,
  listLeaveRequests,
  approveLeave,
  rejectLeave,
};
