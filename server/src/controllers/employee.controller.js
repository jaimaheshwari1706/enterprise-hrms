const { Employee, User, Department, Designation } = require('../models');
const { revokeAllSessions } = require('../services/sessionService');
const getRedisClient = require('../config/redis');
const { startOfDay } = require('../utils/dateHelpers');
const { generateEmployeeId } = require('../utils/generateId');
const { generateTempPassword } = require('../utils/tempPassword');
const { hashPassword } = require('../utils/password');
const { uploadBufferToCloudinary } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta, getSort } = require('../utils/pagination');
const { containsRegex } = require('../utils/regex');
const { logAction } = require('../services/auditService');
const { sendEmployeeWelcomeEmail } = require('../services/emailService');
const { EMPLOYEE_SORT_FIELDS } = require('../validations/employee.validation');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

const POPULATE_FIELDS = [
  { path: 'department', select: 'name code' },
  { path: 'designation', select: 'name code' },
  { path: 'manager', select: 'firstName lastName employeeId' },
];

// What a colleague may see about another employee: the company directory.
// Personal fields (DOB, home address, phone, manager chain) are reserved
// for HR, the person's own manager, and the person themselves.
const DIRECTORY_FIELDS =
  'employeeId firstName lastName email department designation employmentType status profileImageUrl joiningDate createdAt';

function isHR(req) {
  return ['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
}

function ownEmployeeId(req) {
  return req.user.employee?._id?.toString();
}

// Full record for HR, the direct manager, or the employee themselves;
// directory view for everyone else.
function canSeeFullRecord(req, employee) {
  if (isHR(req)) return true;
  const me = ownEmployeeId(req);
  if (!me) return false;
  if (employee._id.toString() === me) return true;
  const managerId = employee.manager?._id?.toString() || employee.manager?.toString();
  return req.user.role === 'MANAGER' && managerId === me;
}

function toDirectoryView(employee) {
  const doc = typeof employee.toObject === 'function' ? employee.toObject({ virtuals: true }) : employee;
  const picked = {};
  for (const field of DIRECTORY_FIELDS.split(' ')) {
    if (doc[field] !== undefined) picked[field] = doc[field];
  }
  picked._id = doc._id;
  picked.id = doc.id || doc._id;
  picked.fullName = `${doc.firstName} ${doc.lastName}`;
  return picked;
}

function buildSearchFilter(search) {
  if (!search) return null;
  const regex = containsRegex(search);
  return { $or: [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }] };
}

// Ensures department/designation exist, the designation belongs to the
// department, and the manager (if any) exists and isn't the employee.
async function assertJobReferences({ department, designation, manager }, selfId = null) {
  const [dept, desig] = await Promise.all([
    Department.findById(department).select('_id status').lean(),
    Designation.findById(designation).select('_id department status').lean(),
  ]);
  if (!dept) throw new ApiError(422, 'Validation failed', ['department: Department not found']);
  if (!desig) throw new ApiError(422, 'Validation failed', ['designation: Designation not found']);
  if (desig.department.toString() !== department) {
    throw new ApiError(422, 'Validation failed', ['designation: Designation does not belong to the selected department']);
  }
  if (manager) {
    if (selfId && manager === selfId) {
      throw new ApiError(422, 'Validation failed', ['manager: An employee cannot be their own manager']);
    }
    const mgr = await Employee.findById(manager).select('_id manager').lean();
    if (!mgr) throw new ApiError(422, 'Validation failed', ['manager: Manager not found']);
    // Prevent a 2-hop cycle (A manages B, B manages A). Deeper cycles are
    // theoretically possible but need deliberate effort; keep this cheap.
    if (selfId && mgr.manager && mgr.manager.toString() === selfId) {
      throw new ApiError(422, 'Validation failed', ['manager: This would create a reporting loop']);
    }
  }
}

// GET /api/employees/search?q=  — compact results for the navbar global search
const quickSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return ok(res, { message: 'Search results', data: [] });
  }

  const filter = buildSearchFilter(q);

  // A MANAGER's quick search is scoped to their own team, same as the main list.
  if (req.user.role === 'MANAGER') {
    if (!req.user.employee) throw new ApiError(403, 'No employee profile linked to this account');
    filter.manager = req.user.employee._id;
  }

  const results = await Employee.find(filter)
    .populate('department', 'name')
    .populate('designation', 'name')
    .limit(8)
    .select('firstName lastName employeeId email profileImageUrl department designation')
    .lean();

  return ok(res, { message: 'Search results', data: results });
});

// GET /api/employees/options — lightweight, unpaginated list for dropdowns
// (manager picker, attendance/payroll filters). Only active employees, only
// the fields a picker needs. Scoped to the team for MANAGER.
const listEmployeeOptions = asyncHandler(async (req, res) => {
  const filter = { status: 'active' };
  if (req.user.role === 'MANAGER') {
    if (!req.user.employee) throw new ApiError(403, 'No employee profile linked to this account');
    filter.manager = req.user.employee._id;
  }

  const data = await Employee.find(filter)
    .select('firstName lastName employeeId department designation')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  return ok(res, { message: 'Employee options', data });
});

// GET /api/employees?page=&limit=&sort=&search=&department=&designation=&status=
const listEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, EMPLOYEE_SORT_FIELDS, { createdAt: -1 });
  const { search, department, designation, status, employmentType } = req.query;

  const filter = {};
  if (department) filter.department = department;
  if (designation) filter.designation = designation;
  if (status) filter.status = status;
  if (employmentType) filter.employmentType = employmentType;

  // A regex search (rather than the $text index) is used here so partial
  // matches work too — e.g. typing "jo" should find "John". $text only
  // matches whole words, which feels broken in a live-search input.
  Object.assign(filter, buildSearchFilter(search) || {});

  // A MANAGER only ever sees their own direct reports — enforced here,
  // not just hidden in the UI, per the RBAC matrix.
  if (req.user.role === 'MANAGER') {
    if (!req.user.employee) throw new ApiError(403, 'No employee profile linked to this account');
    filter.manager = req.user.employee._id;
  }

  const fullAccess = isHR(req) || req.user.role === 'MANAGER';

  // Not .lean(): the response has always carried the `id`/`fullName`
  // virtuals (toJSON virtuals are on), and lean would silently drop them.
  const query = Employee.find(filter).populate(POPULATE_FIELDS).sort(sort).skip(skip).limit(limit);
  if (!fullAccess) query.select(DIRECTORY_FIELDS);

  const [rows, total] = await Promise.all([query, Employee.countDocuments(filter)]);

  const data = fullAccess ? rows : rows.map(toDirectoryView);
  return ok(res, { message: 'Employees fetched', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/employees/:id
const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate(POPULATE_FIELDS);
  if (!employee) throw new ApiError(404, 'Employee not found');

  // A MANAGER may only view their own direct reports or themselves in full.
  // Everyone else gets the directory view (name, role, department...).
  if (canSeeFullRecord(req, employee)) {
    return ok(res, { message: 'Employee fetched', data: employee });
  }

  return ok(res, { message: 'Employee fetched', data: toDirectoryView(employee) });
});

// POST /api/employees  (HR_ADMIN, SUPER_ADMIN)
// Creates the Employee HR record AND a linked User login with a temporary
// password, then emails the credentials (or logs them to the console when
// EMAIL_ENABLED=false).
const createEmployee = asyncHandler(async (req, res) => {
  const { role, ...employeeData } = req.body;
  if (!employeeData.manager) employeeData.manager = null;
  if (!employeeData.dob) employeeData.dob = null;

  // Pre-flight uniqueness on both collections so we never leave an Employee
  // row behind because the login couldn't be provisioned.
  const [emailTakenByEmployee, emailTakenByUser] = await Promise.all([
    Employee.exists({ email: employeeData.email }),
    User.exists({ email: employeeData.email }),
  ]);
  if (emailTakenByEmployee || emailTakenByUser) {
    throw new ApiError(409, 'An account with this email already exists', null, 'DUPLICATE');
  }

  await assertJobReferences(employeeData);

  const employeeId = await generateEmployeeId();
  const employee = await Employee.create({ ...employeeData, employeeId });

  const tempPassword = generateTempPassword();
  let user;
  try {
    user = await User.create({
      email: employee.email,
      passwordHash: await hashPassword(tempPassword),
      role: role || 'EMPLOYEE',
      employee: employee._id,
    });
  } catch (err) {
    // Compensate: the HR record without a login is worse than no record.
    await Employee.deleteOne({ _id: employee._id });
    throw err;
  }

  employee.user = user._id;
  await employee.save();

  try {
    await sendEmployeeWelcomeEmail(employee.email, tempPassword);
  } catch (err) {
    logger.error('Welcome email failed to send', { employeeId: employee.employeeId, error: err, requestId: req.id });
  }

  await logAction({
    user: req.user,
    action: 'CREATE_EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Created employee ${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
    ip: req.ip,
  });

  const populated = await employee.populate(POPULATE_FIELDS);
  await getRedisClient().del('dashboard:hr');
  return created(res, { message: 'Employee created successfully', data: populated });
});

// PUT /api/employees/:id  (HR_ADMIN, SUPER_ADMIN)
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  const body = { ...req.body };
  if (!body.manager) body.manager = null;
  if (!body.dob) body.dob = null;
  if (body.exitDate === '' || body.exitDate === undefined) delete body.exitDate;
  else if (body.exitDate === null) body.exitDate = null;
  else body.exitDate = startOfDay(`${body.exitDate}T00:00:00Z`, 'UTC');

  const emailChanged = body.email && body.email !== employee.email;
  if (emailChanged) {
    const [emailTakenByEmployee, emailTakenByUser] = await Promise.all([
      Employee.exists({ email: body.email, _id: { $ne: employee._id } }),
      User.exists({ email: body.email, _id: { $ne: employee.user } }),
    ]);
    if (emailTakenByEmployee || emailTakenByUser) {
      throw new ApiError(409, 'An account with this email already exists', null, 'DUPLICATE');
    }
  }

  await assertJobReferences(body, employee._id.toString());

  Object.assign(employee, body);
  await employee.save();

  // Keep the linked login's email in sync so the employee can still log in
  // with their (now-updated) work email.
  if (emailChanged && employee.user) {
    await User.findByIdAndUpdate(employee.user, { email: employee.email });
  }

  await logAction({
    user: req.user,
    action: 'UPDATE_EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `Updated employee ${employee.firstName} ${employee.lastName} (${employee.employeeId})`,
    ip: req.ip,
  });

  const populated = await employee.populate(POPULATE_FIELDS);
  await getRedisClient().del('dashboard:hr');
  return ok(res, { message: 'Employee updated successfully', data: populated });
});

// PATCH /api/employees/:id/status  (HR_ADMIN, SUPER_ADMIN)
// Activating/deactivating an employee also flips their login access —
// a deactivated employee shouldn't still be able to sign in, and any
// sessions they have open are revoked.
const updateEmployeeStatus = asyncHandler(async (req, res) => {
  const { status, exitDate } = req.body;

  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  if (employee._id.toString() === ownEmployeeId(req) && status === 'inactive') {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  employee.status = status;
  if (status === 'inactive') {
    // Record the last working day so the final month's payroll can be
    // pro-rated; keep an existing exit date unless HR supplies a new one.
    const exit = exitDate ? startOfDay(`${exitDate}T00:00:00Z`, 'UTC') : employee.exitDate || startOfDay();
    if (exit < startOfDay(employee.joiningDate, 'UTC')) {
      throw new ApiError(400, 'Exit date cannot be before the joining date');
    }
    employee.exitDate = exit;
  } else {
    employee.exitDate = null;
  }
  await employee.save();

  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: status === 'active' });
    if (status === 'inactive') {
      await revokeAllSessions(employee.user, { reason: 'admin' });
    }
  }

  await logAction({
    user: req.user,
    action: status === 'active' ? 'ACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `${status === 'active' ? 'Activated' : 'Deactivated'} employee ${employee.firstName} ${employee.lastName}`,
    ip: req.ip,
  });

  await getRedisClient().del('dashboard:hr');
  return ok(res, {
    message: `Employee ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
    data: employee,
  });
});

// POST /api/employees/:id/profile-image  (HR_ADMIN, SUPER_ADMIN, or the employee themselves)
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Attach an image under the "profileImage" field.');
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  const isSelf = employee._id.toString() === ownEmployeeId(req);
  if (!isSelf && !isHR(req)) {
    throw new ApiError(403, 'You do not have permission to update this profile image');
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, 'hrms/employees');
  employee.profileImageUrl = result.secure_url;
  await employee.save();

  return ok(res, { message: 'Profile image updated successfully', data: employee });
});

module.exports = {
  listEmployees,
  listEmployeeOptions,
  quickSearch,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  uploadProfileImage,
};
