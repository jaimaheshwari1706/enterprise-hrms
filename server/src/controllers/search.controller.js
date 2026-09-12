const { Employee, Department, Designation, LeaveRequest, LeaveType, Payroll } = require('../models');
const { containsRegex } = require('../utils/regex');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');

const PER_GROUP = 5;
const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

function isHR(req) {
  return ['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
}

function employeeNameFilter(q) {
  const regex = containsRegex(q);
  const or = [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }];
  // Full-name search ("jane doe") — a single-field regex can't match it.
  const [first, ...rest] = q.split(/\s+/);
  if (rest.length) or.push({ $and: [{ firstName: containsRegex(first) }, { lastName: containsRegex(rest.join(' ')) }] });
  return { $or: or };
}

// GET /api/search?q=
// One round-trip for the command palette. Every group is scoped the same
// way the corresponding list endpoint is, so the palette can never surface
// something the user couldn't open:
//   employees    HR/admin: everyone; MANAGER: own team; EMPLOYEE: directory
//   departments  everyone (directory data: departments + designations)
//   leaves       HR/admin: all; MANAGER: own team; EMPLOYEE: own requests
//   payroll      HR/admin: all; others: own non-Draft payslips by month
const globalSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const empty = { employees: [], departments: [], leaves: [], payroll: [] };
  if (q.length < 2) return ok(res, { message: 'Search results', data: empty });

  const regex = containsRegex(q);
  const hr = isHR(req);
  const role = req.user.role;
  const me = req.user.employee?._id || null;

  const employeeFilter = employeeNameFilter(q);
  if (role === 'MANAGER') employeeFilter.manager = me;

  // Who the caller may see leave requests for (null = everyone).
  let leaveScope = null;
  if (role === 'MANAGER') leaveScope = me ? await Employee.find({ manager: me }).distinct('_id') : [];
  else if (!hr) leaveScope = me ? [me] : [];

  const statusMatches = LEAVE_STATUSES.filter((s) => regex.test(s));
  const monthLike = /^\d{4}(-\d{0,2})?$/.test(q) ? q : null;
  const payrollWords = /pay(slip|roll)|salary/i.test(q);

  const [employees, departments, designations, leaveTypes, leaveEmployees] = await Promise.all([
    Employee.find(employeeFilter)
      .select('firstName lastName employeeId email profileImageUrl department designation status')
      .populate('department', 'name')
      .populate('designation', 'name')
      .limit(PER_GROUP)
      .lean(),
    Department.find({ $or: [{ name: regex }, { code: regex }] }).select('name code status').limit(PER_GROUP).lean(),
    Designation.find({ $or: [{ name: regex }, { code: regex }] }).select('name code department').populate('department', 'name').limit(PER_GROUP).lean(),
    LeaveType.find({ name: regex }).select('_id').lean(),
    // Requesters whose name matches, inside the caller's scope.
    leaveScope && leaveScope.length === 0
      ? []
      : Employee.find({ ...employeeNameFilter(q), ...(leaveScope ? { _id: { $in: leaveScope } } : {}) }).select('_id').limit(20).lean(),
  ]);

  // Leave requests match by requester name, leave type name or status word,
  // then are restricted to the caller's scope.
  const leaveOr = [];
  if (leaveEmployees.length) leaveOr.push({ employee: { $in: leaveEmployees.map((e) => e._id) } });
  if (leaveTypes.length) leaveOr.push({ leaveType: { $in: leaveTypes.map((t) => t._id) } });
  if (statusMatches.length) leaveOr.push({ status: { $in: statusMatches } });
  const leaveFilter = leaveOr.length && !(leaveScope && leaveScope.length === 0) ? { $or: leaveOr, ...(leaveScope ? { employee: { $in: leaveScope } } : {}) } : null;

  // Payroll: HR by employee name or month; everyone else only their own
  // non-Draft payslips, and only when the query looks like a month or a
  // payroll word (their name is not a useful key for their own payslips).
  let payrollFilter = null;
  if (hr) {
    if (monthLike) payrollFilter = { month: containsRegex(monthLike) };
    else if (employees.length) payrollFilter = { employee: { $in: employees.map((e) => e._id) } };
  } else if (me && (monthLike || payrollWords)) {
    payrollFilter = { employee: me, status: { $ne: 'Draft' }, ...(monthLike ? { month: containsRegex(monthLike) } : {}) };
  }

  const [leaves, payroll] = await Promise.all([
    leaveFilter
      ? LeaveRequest.find(leaveFilter)
          .select('employee leaveType startDate endDate days status')
          .populate('employee', 'firstName lastName employeeId')
          .populate('leaveType', 'name')
          .sort({ createdAt: -1 })
          .limit(PER_GROUP)
          .lean()
      : [],
    payrollFilter
      ? Payroll.find(payrollFilter)
          .select('employee month netSalary status payslipNumber')
          .populate('employee', 'firstName lastName employeeId')
          .sort({ month: -1 })
          .limit(PER_GROUP)
          .lean()
      : [],
  ]);

  return ok(res, {
    message: 'Search results',
    data: {
      employees,
      departments: [
        ...departments.map((d) => ({ _id: d._id, name: d.name, code: d.code, kind: 'department' })),
        ...designations.map((d) => ({ _id: d._id, name: d.name, code: d.code, kind: 'designation', department: d.department?.name })),
      ].slice(0, PER_GROUP),
      leaves,
      payroll,
    },
  });
});

module.exports = { globalSearch };
