const { Employee, Department, Attendance, LeaveRequest, Payroll, LeaveType } = require('../models');
const { startOfDay } = require('../utils/dateHelpers');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');

const HR_DASHBOARD_CACHE_KEY = 'dashboard:hr';
const HR_DASHBOARD_CACHE_TTL_SECONDS = 60;

function currentMonthString(offset = 0) {
  const d = new Date();
  d.setDate(1); // avoid day-of-month overflow (e.g. the 29th rolling past a short February)
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// GET /api/dashboard/hr  (HR_ADMIN, SUPER_ADMIN)
// Demonstrates the cache-aside pattern (Module 17): check Redis first, and
// only hit MongoDB with several aggregation queries on a cache miss. When
// Redis is disabled, getRedisClient() returns a no-op client so this code
// path still works correctly — it just always "misses".
const getHRDashboard = asyncHandler(async (req, res) => {
  const cache = getRedisClient();
  const cached = await cache.get(HR_DASHBOARD_CACHE_KEY);
  if (cached) {
    return ok(res, { message: 'HR dashboard (cached)', data: cached });
  }

  const today = startOfDay();
  const thisMonth = currentMonthString();

  const [totalEmployees, activeEmployees, presentToday, onLeaveToday, pendingApprovals, payrollAgg, byDepartment, leaveStatusAgg] =
    await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: 'active' }),
      Attendance.countDocuments({ date: today, status: { $in: ['Present', 'HalfDay'] } }),
      Attendance.countDocuments({ date: today, status: 'Leave' }),
      LeaveRequest.countDocuments({ status: 'Pending' }),
      Payroll.aggregate([{ $match: { month: thisMonth } }, { $group: { _id: null, total: { $sum: '$netSalary' } } }]),
      Employee.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
      ]),
      LeaveRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

  const absentToday = Math.max(0, activeEmployees - presentToday - onLeaveToday);

  // Attendance overview for the last 7 days — one query per day is simple
  // and easy to follow; at this data scale the cost is negligible.
  const attendanceOverview = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const dayStart = startOfDay(day);
    const [present, halfDay, leave] = await Promise.all([
      Attendance.countDocuments({ date: dayStart, status: 'Present' }),
      Attendance.countDocuments({ date: dayStart, status: 'HalfDay' }),
      Attendance.countDocuments({ date: dayStart, status: 'Leave' }),
    ]);
    attendanceOverview.push({
      date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      present,
      halfDay,
      leave,
    });
  }

  const departments = await Department.find({ _id: { $in: byDepartment.map((d) => d._id).filter(Boolean) } });
  const departmentMap = Object.fromEntries(departments.map((d) => [d._id.toString(), d.name]));
  const employeeDistribution = byDepartment
    .filter((d) => d._id)
    .map((d) => ({ department: departmentMap[d._id.toString()] || 'Unknown', count: d.count }));

  const leaveStatusBreakdown = leaveStatusAgg.map((s) => ({ status: s._id, count: s.count }));

  // Payroll trend for the last 6 months.
  const payrollTrend = [];
  for (let i = 5; i >= 0; i--) {
    const month = currentMonthString(i);
    const agg = await Payroll.aggregate([
      { $match: { month } },
      { $group: { _id: null, total: { $sum: '$netSalary' } } },
    ]);
    payrollTrend.push({ month, total: agg[0]?.total || 0 });
  }

  const data = {
    totalEmployees,
    activeEmployees,
    presentToday,
    absentToday,
    onLeaveToday,
    pendingApprovals,
    monthlyPayrollTotal: payrollAgg[0]?.total || 0,
    charts: { attendanceOverview, employeeDistribution, leaveStatusBreakdown, payrollTrend },
  };

  await cache.set(HR_DASHBOARD_CACHE_KEY, data, HR_DASHBOARD_CACHE_TTL_SECONDS);

  return ok(res, { message: 'HR dashboard', data });
});

// GET /api/dashboard/manager  (MANAGER)
const getManagerDashboard = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(403, 'No employee profile is linked to this account');

  const teamIds = await Employee.find({ manager: req.user.employee._id }).distinct('_id');
  const today = startOfDay();

  const [teamPresentToday, teamOnLeaveToday, pendingApprovals, recentLeaveRequests] = await Promise.all([
    Attendance.countDocuments({ employee: { $in: teamIds }, date: today, status: { $in: ['Present', 'HalfDay'] } }),
    Attendance.countDocuments({ employee: { $in: teamIds }, date: today, status: 'Leave' }),
    LeaveRequest.countDocuments({ employee: { $in: teamIds }, status: 'Pending' }),
    LeaveRequest.find({ employee: { $in: teamIds } })
      .populate('employee', 'firstName lastName')
      .populate('leaveType', 'name')
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const data = {
    teamSize: teamIds.length,
    teamPresentToday,
    teamOnLeaveToday,
    pendingApprovals,
    recentLeaveRequests,
  };

  return ok(res, { message: 'Manager dashboard', data });
});

// GET /api/dashboard/employee  (any authenticated user with a linked employee profile)
const getEmployeeDashboard = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(403, 'No employee profile is linked to this account');
  const employeeId = req.user.employee._id;
  const today = startOfDay();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [todayAttendance, attendanceSummaryAgg, leaveTypes, approvedLeavesThisYear, recentLeaveRequests, latestPayroll] =
    await Promise.all([
      Attendance.findOne({ employee: employeeId, date: today }),
      Attendance.aggregate([
        { $match: { employee: employeeId, date: { $gte: startOfDay(thirtyDaysAgo) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      LeaveType.find(),
      LeaveRequest.aggregate([
        {
          $match: {
            employee: employeeId,
            status: 'Approved',
            startDate: { $gte: new Date(`${new Date().getFullYear()}-01-01`) },
          },
        },
        { $group: { _id: '$leaveType', usedDays: { $sum: '$days' } } },
      ]),
      LeaveRequest.find({ employee: employeeId }).populate('leaveType', 'name').sort({ createdAt: -1 }).limit(5),
      Payroll.findOne({ employee: employeeId, status: { $ne: 'Draft' } }).sort({ month: -1 }),
    ]);

  const usedByType = Object.fromEntries(approvedLeavesThisYear.map((a) => [a._id.toString(), a.usedDays]));
  const leaveBalance = leaveTypes.map((type) => ({
    leaveType: type.name,
    allocated: type.defaultDaysPerYear,
    used: usedByType[type._id.toString()] || 0,
    remaining: type.defaultDaysPerYear - (usedByType[type._id.toString()] || 0),
  }));

  const attendanceSummary = Object.fromEntries(attendanceSummaryAgg.map((a) => [a._id, a.count]));

  const data = {
    todayAttendance,
    attendanceSummary: {
      present: attendanceSummary.Present || 0,
      halfDay: attendanceSummary.HalfDay || 0,
      leave: attendanceSummary.Leave || 0,
    },
    leaveBalance,
    recentLeaveRequests,
    latestPayroll,
  };

  return ok(res, { message: 'Employee dashboard', data });
});

module.exports = { getHRDashboard, getManagerDashboard, getEmployeeDashboard };
