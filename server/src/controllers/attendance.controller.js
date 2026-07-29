const { Attendance } = require('../models');
const { startOfDay, endOfDay } = require('../utils/dateHelpers');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');

// A full day is 8 working hours; anything less (but still checked in/out)
// counts as a half day. This is intentionally simple — no shift rules, no
// overtime, no break deductions — per the "simplified attendance/payroll"
// scope of this project.
const FULL_DAY_HOURS = 8;

function requireEmployeeProfile(req) {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  return req.user.employee._id;
}

// POST /api/attendance/check-in
const checkIn = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const today = startOfDay();

  let attendance = await Attendance.findOne({ employee: employeeId, date: today });

  if (attendance?.checkIn) {
    throw new ApiError(409, 'You have already checked in today');
  }

  if (attendance) {
    attendance.checkIn = new Date();
    attendance.status = 'Present';
    await attendance.save();
  } else {
    attendance = await Attendance.create({
      employee: employeeId,
      date: today,
      checkIn: new Date(),
      status: 'Present',
    });
  }

  await getRedisClient().del('dashboard:hr');
  return created(res, { message: 'Checked in successfully', data: attendance });
});

// POST /api/attendance/check-out
const checkOut = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const today = startOfDay();

  const attendance = await Attendance.findOne({ employee: employeeId, date: today });

  if (!attendance || !attendance.checkIn) {
    throw new ApiError(400, 'You need to check in before you can check out');
  }
  if (attendance.checkOut) {
    throw new ApiError(409, 'You have already checked out today');
  }

  const checkOutTime = new Date();
  const hoursWorked = (checkOutTime - attendance.checkIn) / (1000 * 60 * 60);

  attendance.checkOut = checkOutTime;
  attendance.workingHours = Math.round(hoursWorked * 100) / 100;
  attendance.status = hoursWorked >= FULL_DAY_HOURS ? 'Present' : 'HalfDay';
  await attendance.save();

  await getRedisClient().del('dashboard:hr');
  return ok(res, { message: 'Checked out successfully', data: attendance });
});

// GET /api/attendance/me/today
const getTodayAttendance = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const today = startOfDay();

  const attendance = await Attendance.findOne({ employee: employeeId, date: today });
  return ok(res, { message: "Today's attendance", data: attendance });
});

// GET /api/attendance/me/history?page=&limit=&from=&to=
const getMyHistory = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const { page, limit, skip } = getPagination(req.query);
  const { from, to } = req.query;

  const filter = { employee: employeeId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDay(new Date(from));
    if (to) filter.date.$lte = endOfDay(new Date(to));
  }

  const [data, total] = await Promise.all([
    Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);

  return ok(res, { message: 'Attendance history', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/attendance?page=&limit=&employee=&from=&to=&status=  (HR_ADMIN, SUPER_ADMIN, MANAGER)
const listAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { employee, from, to, status } = req.query;

  const filter = {};
  if (employee) filter.employee = employee;
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDay(new Date(from));
    if (to) filter.date.$lte = endOfDay(new Date(to));
  }

  // A MANAGER only sees attendance for their own direct reports. If they
  // pass an `employee` filter, it must still be one of their reports —
  // otherwise they could query any employee's attendance directly.
  if (req.user.role === 'MANAGER') {
    const { Employee } = require('../models');
    const teamIds = (await Employee.find({ manager: req.user.employee?._id }).distinct('_id')).map(String);
    if (employee && !teamIds.includes(employee)) {
      throw new ApiError(403, 'You can only view attendance for your own team');
    }
    filter.employee = employee || { $in: teamIds };
  }

  const [data, total] = await Promise.all([
    Attendance.find(filter)
      .populate('employee', 'firstName lastName employeeId profileImageUrl')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter),
  ]);

  return ok(res, { message: 'Attendance records', data, pagination: buildPaginationMeta(page, limit, total) });
});

module.exports = { checkIn, checkOut, getTodayAttendance, getMyHistory, listAttendance };
