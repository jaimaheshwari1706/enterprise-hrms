const { LeaveType, LeaveRequest, Approval, Employee, User, Attendance } = require('../models');
const { startOfDay } = require('../utils/dateHelpers');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { sendLeaveSubmittedEmail, sendLeaveStatusEmail } = require('../services/emailService');
const ApiError = require('../utils/ApiError');

function requireEmployeeProfile(req) {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  return req.user.employee;
}

// Inclusive day count between two dates — deliberately simple (no weekend
// or holiday exclusion), matching the "simplified leave management" scope.
function calculateLeaveDays(startDate, endDate) {
  const diffMs = startOfDay(endDate) - startOfDay(startDate);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
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

// GET /api/leaves/leave-types
const listLeaveTypes = asyncHandler(async (req, res) => {
  const leaveTypes = await LeaveType.find().sort({ name: 1 });
  return ok(res, { message: 'Leave types', data: leaveTypes });
});

// POST /api/leaves/apply
const applyLeave = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);
  const { leaveType, startDate, endDate, reason } = req.body;

  const type = await LeaveType.findById(leaveType);
  if (!type) throw new ApiError(404, 'Leave type not found');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw new ApiError(400, 'End date cannot be before start date');

  const days = calculateLeaveDays(start, end);

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
  for (const { user } of approvers) {
    await notify({
      user: user._id,
      title: 'New leave request',
      message: `${employeeName} requested ${type.name} from ${start.toDateString()} to ${end.toDateString()}`,
      type: 'LEAVE',
      link: `/leaves/approvals`,
    });
    await sendLeaveSubmittedEmail(user.email, employeeName, type.name, start.toDateString(), end.toDateString());
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

// GET /api/leaves/me?page=&limit=&status=
const getMyLeaves = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);
  const { page, limit, skip } = getPagination(req.query);
  const { status } = req.query;

  const filter = { employee: employee._id };
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    LeaveRequest.find(filter).populate('leaveType').sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);

  return ok(res, { message: 'My leave requests', data, pagination: buildPaginationMeta(page, limit, total) });
});

// PATCH /api/leaves/:id/cancel
const cancelLeave = asyncHandler(async (req, res) => {
  const employee = requireEmployeeProfile(req);
  const leaveRequest = await LeaveRequest.findById(req.params.id);

  if (!leaveRequest) throw new ApiError(404, 'Leave request not found');
  if (leaveRequest.employee.toString() !== employee._id.toString()) {
    throw new ApiError(403, 'You can only cancel your own leave requests');
  }
  if (leaveRequest.status !== 'Pending') {
    throw new ApiError(409, 'Only pending leave requests can be cancelled');
  }

  leaveRequest.status = 'Cancelled';
  await leaveRequest.save();

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

  return ok(res, { message: 'Leave request cancelled', data: leaveRequest });
});

// GET /api/leaves?page=&limit=&status=&employee=  (HR_ADMIN, SUPER_ADMIN, MANAGER)
const listLeaveRequests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, employee } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (employee) filter.employee = employee;

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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);

  return ok(res, { message: 'Leave requests', data, pagination: buildPaginationMeta(page, limit, total) });
});

// Shared authorization + core logic for approve/reject.
async function resolveLeaveDecision(req, decision) {
  const leaveRequest = await LeaveRequest.findById(req.params.id).populate('employee').populate('leaveType');
  if (!leaveRequest) throw new ApiError(404, 'Leave request not found');
  if (leaveRequest.status !== 'Pending') {
    throw new ApiError(409, 'This leave request has already been actioned');
  }

  const approverEmployee = req.user.employee;
  const isDirectManager = approverEmployee && leaveRequest.employee.manager?.toString() === approverEmployee._id.toString();
  const isHRFallback = ['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);

  if (!isDirectManager && !isHRFallback) {
    throw new ApiError(403, 'You are not authorized to act on this leave request');
  }

  leaveRequest.status = decision;
  leaveRequest.approver = approverEmployee?._id || null;
  leaveRequest.approverComment = req.body.comment || '';
  await leaveRequest.save();

  await Approval.findOneAndUpdate(
    { requestType: 'LEAVE', requestId: leaveRequest._id, status: 'Pending' },
    {
      status: decision,
      approver: approverEmployee?._id || null,
      comment: req.body.comment || '',
      actionDate: new Date(),
    }
  );

  // Reusing the Attendance model here: approved leave days are marked with
  // status='Leave' so attendance reports and the dashboard automatically
  // reflect who's on leave, without any extra bookkeeping.
  if (decision === 'Approved') {
    const dayCount = leaveRequest.days;
    const cursor = new Date(leaveRequest.startDate);
    for (let i = 0; i < dayCount; i++) {
      const day = startOfDay(cursor);
      await Attendance.findOneAndUpdate(
        { employee: leaveRequest.employee._id, date: day },
        { employee: leaveRequest.employee._id, date: day, status: 'Leave' },
        { upsert: true }
      );
      cursor.setDate(cursor.getDate() + 1);
    }
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
      await sendLeaveStatusEmail(
        employeeUser.email,
        decision,
        leaveRequest.leaveType.name,
        leaveRequest.startDate.toDateString(),
        leaveRequest.endDate.toDateString(),
        leaveRequest.approverComment
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
  applyLeave,
  getMyLeaves,
  cancelLeave,
  listLeaveRequests,
  approveLeave,
  rejectLeave,
};
