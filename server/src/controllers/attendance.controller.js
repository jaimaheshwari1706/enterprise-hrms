const { Attendance, Employee } = require('../models');
const { startOfDay, endOfDay } = require('../utils/dateHelpers');
const { calculateWorkingHours, deriveAttendanceStatus } = require('../utils/attendanceCalculations');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta, getSort } = require('../utils/pagination');
const { ATTENDANCE_SORT_FIELDS } = require('../validations/attendance.validation');
const ApiError = require('../utils/ApiError');

function requireEmployeeProfile(req) {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  return req.user.employee._id;
}

function buildDateFilter(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = startOfDay(`${from}T00:00:00Z`);
  if (to) range.$lte = endOfDay(`${to}T00:00:00Z`);
  return range;
}

// Direct reports of the current (MANAGER) user, as strings.
async function teamIdsFor(req) {
  const ids = await Employee.find({ manager: req.user.employee?._id }).distinct('_id');
  return ids.map(String);
}

// POST /api/attendance/check-in
// One atomic upsert: creates today's record with the check-in time, or
// fills in the check-in on a record that exists without one (e.g. a day
// pre-marked as Leave). If a record with a check-in already exists the
// filter doesn't match, the upsert tries to insert, and the unique
// (employee, date) index rejects it — which we translate to a clear 409.
// Two concurrent check-ins therefore can never both succeed.
const checkIn = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const today = startOfDay();

  let attendance;
  try {
    attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: today, checkIn: null },
      { $set: { checkIn: new Date(), status: 'Present' } },
      { upsert: true, new: true, runValidators: true }
    );
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already checked in today');
    throw err;
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
  const hoursWorked = calculateWorkingHours(attendance.checkIn, checkOutTime);

  // Conditional update so a double-submitted check-out can't overwrite the
  // first one's time/hours.
  const updated = await Attendance.findOneAndUpdate(
    { _id: attendance._id, checkOut: null },
    { $set: { checkOut: checkOutTime, workingHours: hoursWorked, status: deriveAttendanceStatus(hoursWorked) } },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'You have already checked out today');

  await getRedisClient().del('dashboard:hr');
  return ok(res, { message: 'Checked out successfully', data: updated });
});

// GET /api/attendance/me/today
const getTodayAttendance = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const today = startOfDay();

  const attendance = await Attendance.findOne({ employee: employeeId, date: today }).lean();
  return ok(res, { message: "Today's attendance", data: attendance });
});

// GET /api/attendance/me/history?page=&limit=&sort=&from=&to=&status=
const getMyHistory = asyncHandler(async (req, res) => {
  const employeeId = requireEmployeeProfile(req);
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ATTENDANCE_SORT_FIELDS, { date: -1 });
  const { from, to, status } = req.query;

  const filter = { employee: employeeId };
  if (status) filter.status = status;
  const dateFilter = buildDateFilter(from, to);
  if (dateFilter) filter.date = dateFilter;

  const [data, total] = await Promise.all([
    Attendance.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Attendance.countDocuments(filter),
  ]);

  return ok(res, { message: 'Attendance history', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/attendance?page=&limit=&sort=&employee=&from=&to=&status=  (HR_ADMIN, SUPER_ADMIN, MANAGER)
const listAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, ATTENDANCE_SORT_FIELDS, { date: -1 });
  const { employee, from, to, status } = req.query;

  const filter = {};
  if (employee) filter.employee = employee;
  if (status) filter.status = status;
  const dateFilter = buildDateFilter(from, to);
  if (dateFilter) filter.date = dateFilter;

  // A MANAGER only sees attendance for their own direct reports. If they
  // pass an `employee` filter, it must still be one of their reports —
  // otherwise they could query any employee's attendance directly.
  if (req.user.role === 'MANAGER') {
    const teamIds = await teamIdsFor(req);
    if (employee && !teamIds.includes(employee)) {
      throw new ApiError(403, 'You can only view attendance for your own team');
    }
    filter.employee = employee || { $in: teamIds };
  }

  const [data, total] = await Promise.all([
    Attendance.find(filter)
      .populate('employee', 'firstName lastName employeeId profileImageUrl')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);

  return ok(res, { message: 'Attendance records', data, pagination: buildPaginationMeta(page, limit, total) });
});

module.exports = { checkIn, checkOut, getTodayAttendance, getMyHistory, listAttendance };
