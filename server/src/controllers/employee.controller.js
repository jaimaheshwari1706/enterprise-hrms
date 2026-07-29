const { Employee, User } = require('../models');
const getRedisClient = require('../config/redis');
const { generateEmployeeId } = require('../utils/generateId');
const { generateTempPassword } = require('../utils/tempPassword');
const { hashPassword } = require('../utils/password');
const { uploadBufferToCloudinary } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const { sendEmployeeWelcomeEmail } = require('../services/emailService');
const ApiError = require('../utils/ApiError');

const POPULATE_FIELDS = [
  { path: 'department', select: 'name code' },
  { path: 'designation', select: 'name code' },
  { path: 'manager', select: 'firstName lastName employeeId' },
];

// GET /api/employees/search?q=  — compact results for the navbar global search
const quickSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return ok(res, { message: 'Search results', data: [] });
  }

  const regex = new RegExp(q.trim(), 'i');
  const filter = {
    $or: [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }],
  };

  // A MANAGER's quick search is scoped to their own team, same as the main list.
  if (req.user.role === 'MANAGER') {
    if (!req.user.employee) throw new ApiError(403, 'No employee profile linked to this account');
    filter.manager = req.user.employee._id;
  }

  const results = await Employee.find(filter)
    .populate('department', 'name')
    .populate('designation', 'name')
    .limit(8)
    .select('firstName lastName employeeId email profileImageUrl department designation');

  return ok(res, { message: 'Search results', data: results });
});

// GET /api/employees?page=&limit=&search=&department=&designation=&status=
const listEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search, department, designation, status } = req.query;

  const filter = {};
  if (department) filter.department = department;
  if (designation) filter.designation = designation;
  if (status) filter.status = status;

  // A regex search (rather than the $text index) is used here so partial
  // matches work too — e.g. typing "jo" should find "John". $text only
  // matches whole words, which feels broken in a live-search input.
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }];
  }

  // A MANAGER only ever sees their own direct reports — enforced here,
  // not just hidden in the UI, per the RBAC matrix.
  if (req.user.role === 'MANAGER') {
    if (!req.user.employee) throw new ApiError(403, 'No employee profile linked to this account');
    filter.manager = req.user.employee._id;
  }

  const [data, total] = await Promise.all([
    Employee.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Employee.countDocuments(filter),
  ]);

  return ok(res, { message: 'Employees fetched', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/employees/:id
const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate(POPULATE_FIELDS);
  if (!employee) throw new ApiError(404, 'Employee not found');

  // A MANAGER may only view their own direct reports or themselves.
  if (req.user.role === 'MANAGER') {
    const isOwnReport = employee.manager?.toString() === req.user.employee?._id?.toString();
    const isSelf = employee._id.toString() === req.user.employee?._id?.toString();
    if (!isOwnReport && !isSelf) {
      throw new ApiError(403, 'You can only view your own team');
    }
  }

  return ok(res, { message: 'Employee fetched', data: employee });
});

// POST /api/employees  (HR_ADMIN, SUPER_ADMIN)
// Creates the Employee HR record AND a linked User login with a temporary
// password, then emails the credentials (or logs them to the console when
// EMAIL_ENABLED=false).
const createEmployee = asyncHandler(async (req, res) => {
  const { role, ...employeeData } = req.body;

  const employeeId = await generateEmployeeId();
  const employee = await Employee.create({ ...employeeData, employeeId });

  const tempPassword = generateTempPassword();
  const user = await User.create({
    email: employee.email,
    passwordHash: await hashPassword(tempPassword),
    role: role || 'EMPLOYEE',
    employee: employee._id,
  });

  employee.user = user._id;
  await employee.save();

  await sendEmployeeWelcomeEmail(employee.email, tempPassword);

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

  const emailChanged = req.body.email && req.body.email !== employee.email;

  Object.assign(employee, req.body);
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
  return ok(res, { message: 'Employee updated successfully', data: populated });
});

// PATCH /api/employees/:id/status  (HR_ADMIN, SUPER_ADMIN)
// Activating/deactivating an employee also flips their login access —
// a deactivated employee shouldn't still be able to sign in.
const updateEmployeeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  employee.status = status;
  await employee.save();

  if (employee.user) {
    await User.findByIdAndUpdate(employee.user, { isActive: status === 'active' });
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
  return ok(res, { message: `Employee ${status === 'active' ? 'activated' : 'deactivated'} successfully`, data: employee });
});


// POST /api/employees/:id/profile-image  (HR_ADMIN, SUPER_ADMIN, or the employee themselves)
const uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Attach an image under the "profileImage" field.');
  }

  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new ApiError(404, 'Employee not found');

  const isSelf = employee._id.toString() === req.user.employee?._id?.toString();
  const isHR = ['HR_ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
  if (!isSelf && !isHR) {
    throw new ApiError(403, 'You do not have permission to update this profile image');
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, 'hrms/employees');
  employee.profileImageUrl = result.secure_url;
  await employee.save();

  return ok(res, { message: 'Profile image updated successfully', data: employee });
});

module.exports = {
  listEmployees,
  quickSearch,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  uploadProfileImage,
};
