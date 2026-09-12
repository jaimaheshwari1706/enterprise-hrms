const { Employee, Department, Attendance, LeaveRequest, LeaveType, Payroll, AuditLog } = require('../models');
const { startOfDay, addDays, monthString, startOfYear, toDateString } = require('../utils/dateHelpers');
const { getWorkingCalendar } = require('../services/calendarService');
const { isWorkingDay, holidayName, weekdayName, countWorkingDays } = require('../utils/workingDays');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');

const HR_DASHBOARD_CACHE_KEY = 'dashboard:hr';
const HR_DASHBOARD_CACHE_TTL_SECONDS = 60;

const ATTENDANCE_WINDOW_DAYS = 7;
const PAYROLL_WINDOW_MONTHS = 6;
const JOINING_WINDOW_MONTHS = 6;

// Short "Sep 12" style label for chart axes, always in UTC because day
// keys are UTC midnights (see dateHelpers).
function dayLabel(dayKey) {
  return dayKey.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// { date, weekday, working, holiday } for a day key — lets the UI explain
// why "absent" is 0 on a Sunday or a holiday.
function describeDay(dayKey, calendar) {
  return {
    date: toDateString(dayKey, 'UTC'),
    weekday: weekdayName(dayKey),
    working: isWorkingDay(dayKey, calendar),
    holiday: holidayName(dayKey, calendar),
  };
}

// GET /api/dashboard/hr  (HR_ADMIN, SUPER_ADMIN)
// Cache-aside: check Redis first, and only hit MongoDB on a miss. When
// Redis is disabled getRedisClient() returns a no-op client so this code
// path still works — it just always "misses". Every metric below comes
// from real collections; nothing is estimated or invented.
const getHRDashboard = asyncHandler(async (req, res) => {
  const cache = getRedisClient();
  const cached = await cache.get(HR_DASHBOARD_CACHE_KEY);
  if (cached) {
    return ok(res, { message: 'HR dashboard (cached)', data: cached });
  }

  const today = startOfDay();
  const { calendar } = await getWorkingCalendar();
  const todayInfo = describeDay(today, calendar);
  const windowStart = addDays(today, -(ATTENDANCE_WINDOW_DAYS - 1));
  const thisMonth = monthString();
  const payrollMonths = Array.from({ length: PAYROLL_WINDOW_MONTHS }, (_, i) => monthString(new Date(), PAYROLL_WINDOW_MONTHS - 1 - i));
  const joiningWindowStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (JOINING_WINDOW_MONTHS - 1), 1));
  const thirtyDaysAgo = addDays(today, -30);

  const [
    totalEmployees,
    activeEmployees,
    newJoiners30d,
    todayAgg,
    pendingApprovals,
    leaveStatusAgg,
    byDepartment,
    byEmploymentType,
    attendanceAgg,
    payrollAgg,
    payrollStatusAgg,
    joiningAgg,
    recentActivity,
    leaveTypeUsage,
    leaveTypes,
  ] = await Promise.all([
    Employee.countDocuments(),
    Employee.countDocuments({ status: 'active' }),
    Employee.countDocuments({ joiningDate: { $gte: thirtyDaysAgo } }),
    Attendance.aggregate([{ $match: { date: today } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    LeaveRequest.countDocuments({ status: 'Pending' }),
    LeaveRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Employee.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Employee.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$employmentType', count: { $sum: 1 } } },
    ]),
    // One query for the whole 7-day window instead of 21 counts.
    Attendance.aggregate([
      { $match: { date: { $gte: windowStart, $lte: today } } },
      { $group: { _id: { date: '$date', status: '$status' }, count: { $sum: 1 } } },
    ]),
    // One query for the 6-month payroll trend instead of 6.
    Payroll.aggregate([
      { $match: { month: { $in: payrollMonths } } },
      { $group: { _id: '$month', total: { $sum: '$netSalary' }, gross: { $sum: '$grossSalary' }, count: { $sum: 1 } } },
    ]),
    Payroll.aggregate([
      { $match: { month: thisMonth } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$netSalary' } } },
    ]),
    Employee.aggregate([
      { $match: { joiningDate: { $gte: joiningWindowStart } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$joiningDate', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]),
    AuditLog.find()
      .populate('user', 'email role')
      .sort({ createdAt: -1 })
      .limit(8)
      .select('action entityType description createdAt user')
      .lean(),
    LeaveRequest.aggregate([
      { $match: { status: 'Approved', startDate: { $gte: startOfYear() } } },
      { $group: { _id: '$leaveType', days: { $sum: '$days' }, requests: { $sum: 1 } } },
    ]),
    LeaveType.find().select('name defaultDaysPerYear').lean(),
  ]);

  // --- Today ---------------------------------------------------------------
  const todayByStatus = Object.fromEntries(todayAgg.map((r) => [r._id, r.count]));
  const presentToday = (todayByStatus.Present || 0) + (todayByStatus.HalfDay || 0);
  const onLeaveToday = todayByStatus.Leave || 0;
  // Nobody is "absent" on a weekend or holiday.
  const absentToday = todayInfo.working ? Math.max(0, activeEmployees - presentToday - onLeaveToday) : 0;

  // --- Attendance overview (last 7 days) -----------------------------------
  const attendanceByDay = new Map();
  for (const row of attendanceAgg) {
    const key = row._id.date.toISOString();
    if (!attendanceByDay.has(key)) attendanceByDay.set(key, { Present: 0, HalfDay: 0, Leave: 0, Absent: 0 });
    attendanceByDay.get(key)[row._id.status] = row.count;
  }
  const attendanceOverview = [];
  for (let i = 0; i < ATTENDANCE_WINDOW_DAYS; i++) {
    const day = addDays(windowStart, i);
    const counts = attendanceByDay.get(day.toISOString()) || { Present: 0, HalfDay: 0, Leave: 0 };
    const info = describeDay(day, calendar);
    attendanceOverview.push({
      date: dayLabel(day),
      isoDate: toDateString(day, 'UTC'),
      present: counts.Present || 0,
      halfDay: counts.HalfDay || 0,
      leave: counts.Leave || 0,
      working: info.working,
      holiday: info.holiday,
    });
  }

  // --- Workforce -------------------------------------------------------------
  const departments = await Department.find({ _id: { $in: byDepartment.map((d) => d._id).filter(Boolean) } })
    .select('name')
    .lean();
  const departmentMap = Object.fromEntries(departments.map((d) => [d._id.toString(), d.name]));
  const employeeDistribution = byDepartment
    .filter((d) => d._id)
    .map((d) => ({ department: departmentMap[d._id.toString()] || 'Unknown', count: d.count }));

  const employmentTypeDistribution = byEmploymentType
    .filter((r) => r._id)
    .map((r) => ({ type: r._id, count: r.count }))
    .sort((a, b) => b.count - a.count);

  const joiningByMonth = Object.fromEntries(joiningAgg.map((r) => [r._id, r.count]));
  const joiningTrend = Array.from({ length: JOINING_WINDOW_MONTHS }, (_, i) => {
    const month = monthString(new Date(), JOINING_WINDOW_MONTHS - 1 - i);
    return { month, count: joiningByMonth[month] || 0 };
  });

  // --- Leave -----------------------------------------------------------------
  const leaveStatusBreakdown = leaveStatusAgg.map((s) => ({ status: s._id, count: s.count }));
  const usageByType = Object.fromEntries(leaveTypeUsage.map((r) => [r._id.toString(), r]));
  const leaveUtilization = leaveTypes.map((type) => {
    const usage = usageByType[type._id.toString()];
    return {
      leaveType: type.name,
      allocatedPerEmployee: type.defaultDaysPerYear,
      approvedDays: usage?.days || 0,
      approvedRequests: usage?.requests || 0,
    };
  });

  // --- Payroll ---------------------------------------------------------------
  const payrollByMonth = Object.fromEntries(payrollAgg.map((r) => [r._id, r]));
  const payrollTrend = payrollMonths.map((month) => ({
    month,
    total: payrollByMonth[month]?.total || 0,
    gross: payrollByMonth[month]?.gross || 0,
    count: payrollByMonth[month]?.count || 0,
  }));
  const payrollStatusCounts = { Draft: 0, Processed: 0, Paid: 0 };
  let monthlyPayrollTotal = 0;
  for (const row of payrollStatusAgg) {
    payrollStatusCounts[row._id] = row.count;
    monthlyPayrollTotal += row.total;
  }
  const payrollRecordsThisMonth = payrollStatusCounts.Draft + payrollStatusCounts.Processed + payrollStatusCounts.Paid;
  let payrollStatus = 'Not generated';
  if (payrollRecordsThisMonth > 0) {
    if (payrollStatusCounts.Paid === payrollRecordsThisMonth) payrollStatus = 'Paid';
    else if (payrollStatusCounts.Draft === 0) payrollStatus = 'Processed';
    else payrollStatus = 'In progress';
  }

  const data = {
    generatedAt: new Date().toISOString(),
    today: todayInfo,
    totalEmployees,
    activeEmployees,
    inactiveEmployees: totalEmployees - activeEmployees,
    newJoiners30d,
    presentToday,
    absentToday,
    onLeaveToday,
    halfDayToday: todayByStatus.HalfDay || 0,
    pendingApprovals,
    monthlyPayrollTotal,
    payroll: {
      month: thisMonth,
      status: payrollStatus,
      records: payrollRecordsThisMonth,
      eligibleEmployees: activeEmployees,
      byStatus: payrollStatusCounts,
    },
    charts: {
      attendanceOverview,
      employeeDistribution,
      employmentTypeDistribution,
      joiningTrend,
      leaveStatusBreakdown,
      leaveUtilization,
      payrollTrend,
    },
    recentActivity: recentActivity.map((log) => ({
      id: log._id,
      action: log.action,
      entityType: log.entityType,
      description: log.description,
      createdAt: log.createdAt,
      user: log.user ? { email: log.user.email, role: log.user.role } : null,
    })),
  };

  await cache.set(HR_DASHBOARD_CACHE_KEY, data, HR_DASHBOARD_CACHE_TTL_SECONDS);

  return ok(res, { message: 'HR dashboard', data });
});

// GET /api/dashboard/manager  (MANAGER)
const getManagerDashboard = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(403, 'No employee profile is linked to this account');

  const today = startOfDay();
  const { calendar } = await getWorkingCalendar();
  const todayInfo = describeDay(today, calendar);
  const team = await Employee.find({ manager: req.user.employee._id, status: 'active' })
    .select('firstName lastName employeeId profileImageUrl designation')
    .populate('designation', 'name')
    .sort({ firstName: 1 })
    .lean();
  const teamIds = team.map((e) => e._id);

  const [todayAttendance, pendingApprovals, recentLeaveRequests, onLeaveUpcoming] = await Promise.all([
    Attendance.find({ employee: { $in: teamIds }, date: today }).select('employee status checkIn checkOut').lean(),
    LeaveRequest.countDocuments({ employee: { $in: teamIds }, status: 'Pending' }),
    LeaveRequest.find({ employee: { $in: teamIds } })
      .populate('employee', 'firstName lastName')
      .populate('leaveType', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    LeaveRequest.countDocuments({
      employee: { $in: teamIds },
      status: 'Approved',
      startDate: { $gt: today, $lte: addDays(today, 7) },
    }),
  ]);

  const attendanceByEmployee = new Map(todayAttendance.map((a) => [a.employee.toString(), a]));
  const teamToday = team.map((member) => {
    const record = attendanceByEmployee.get(member._id.toString());
    return {
      ...member,
      todayStatus: record ? record.status : 'Absent',
      checkIn: record?.checkIn || null,
      checkOut: record?.checkOut || null,
    };
  });

  const teamPresentToday = teamToday.filter((m) => m.todayStatus === 'Present' || m.todayStatus === 'HalfDay').length;
  const teamOnLeaveToday = teamToday.filter((m) => m.todayStatus === 'Leave').length;

  const data = {
    today: todayInfo,
    teamSize: teamIds.length,
    teamPresentToday,
    teamOnLeaveToday,
    teamAbsentToday: todayInfo.working ? Math.max(0, teamIds.length - teamPresentToday - teamOnLeaveToday) : 0,
    pendingApprovals,
    upcomingLeaves7d: onLeaveUpcoming,
    teamToday,
    recentLeaveRequests,
  };

  return ok(res, { message: 'Manager dashboard', data });
});

// GET /api/dashboard/employee  (any authenticated user with a linked employee profile)
const getEmployeeDashboard = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(403, 'No employee profile is linked to this account');
  const employeeId = req.user.employee._id;
  const today = startOfDay();
  const thirtyDaysAgo = addDays(today, -30);
  const { calendar } = await getWorkingCalendar();
  const todayInfo = describeDay(today, calendar);
  // Working days in the 30-day window (up to and including today) — the
  // denominator for "days you should have been in".
  const workingDaysInWindow = countWorkingDays(thirtyDaysAgo, today, calendar);

  const [todayAttendance, attendanceSummaryAgg, leaveTypes, leaveUsageAgg, recentLeaveRequests, latestPayroll, upcomingLeave] =
    await Promise.all([
      Attendance.findOne({ employee: employeeId, date: today }).lean(),
      Attendance.aggregate([
        { $match: { employee: employeeId, date: { $gte: thirtyDaysAgo } } },
        { $group: { _id: '$status', count: { $sum: 1 }, hours: { $sum: '$workingHours' } } },
      ]),
      LeaveType.find().sort({ name: 1 }).lean(),
      LeaveRequest.aggregate([
        {
          $match: {
            employee: employeeId,
            status: { $in: ['Approved', 'Pending'] },
            startDate: { $gte: startOfYear() },
          },
        },
        { $group: { _id: { leaveType: '$leaveType', status: '$status' }, days: { $sum: '$days' } } },
      ]),
      LeaveRequest.find({ employee: employeeId }).populate('leaveType', 'name').sort({ createdAt: -1 }).limit(5).lean(),
      Payroll.findOne({ employee: employeeId, status: { $ne: 'Draft' } }).sort({ month: -1 }).lean(),
      LeaveRequest.findOne({ employee: employeeId, status: 'Approved', startDate: { $gte: today } })
        .populate('leaveType', 'name')
        .sort({ startDate: 1 })
        .lean(),
    ]);

  const usage = {};
  for (const row of leaveUsageAgg) {
    const key = row._id.leaveType.toString();
    usage[key] = usage[key] || { used: 0, pending: 0 };
    if (row._id.status === 'Approved') usage[key].used += row.days;
    else usage[key].pending += row.days;
  }
  const leaveBalance = leaveTypes.map((type) => {
    const u = usage[type._id.toString()] || { used: 0, pending: 0 };
    return {
      leaveTypeId: type._id,
      leaveType: type.name,
      allocated: type.defaultDaysPerYear,
      used: u.used,
      pending: u.pending,
      remaining: Math.max(0, type.defaultDaysPerYear - u.used - u.pending),
    };
  });

  const summary = Object.fromEntries(attendanceSummaryAgg.map((a) => [a._id, a]));
  const totalHours = attendanceSummaryAgg.reduce((sum, a) => sum + (a.hours || 0), 0);
  const workedDays = (summary.Present?.count || 0) + (summary.HalfDay?.count || 0);

  const leaveDays = summary.Leave?.count || 0;
  const data = {
    today: todayInfo,
    todayAttendance,
    attendanceSummary: {
      windowDays: 30,
      workingDays: workingDaysInWindow,
      present: summary.Present?.count || 0,
      halfDay: summary.HalfDay?.count || 0,
      leave: leaveDays,
      absent: Math.max(0, workingDaysInWindow - workedDays - leaveDays),
      totalHours: Math.round(totalHours * 100) / 100,
      averageHours: workedDays ? Math.round((totalHours / workedDays) * 100) / 100 : 0,
    },
    leaveBalance,
    upcomingLeave,
    recentLeaveRequests,
    latestPayroll,
  };

  return ok(res, { message: 'Employee dashboard', data });
});

module.exports = { getHRDashboard, getManagerDashboard, getEmployeeDashboard };
