const { Department, Designation, Employee } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { logAction } = require('../services/auditService');
const ApiError = require('../utils/ApiError');

// GET /api/departments?page=&limit=&search=&status=
const listDepartments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { search, status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const [data, total] = await Promise.all([
    Department.find(filter)
      .populate('head', 'firstName lastName employeeId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Department.countDocuments(filter),
  ]);

  return ok(res, { message: 'Departments fetched', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/departments/:id
const getDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id).populate('head', 'firstName lastName employeeId');
  if (!department) throw new ApiError(404, 'Department not found');
  return ok(res, { message: 'Department fetched', data: department });
});

// POST /api/departments  (HR_ADMIN, SUPER_ADMIN)
const createDepartment = asyncHandler(async (req, res) => {
  const department = await Department.create(req.body);

  await logAction({
    user: req.user,
    action: 'CREATE_DEPARTMENT',
    entityType: 'Department',
    entityId: department._id,
    description: `Created department ${department.name}`,
    ip: req.ip,
  });

  return created(res, { message: 'Department created successfully', data: department });
});

// PUT /api/departments/:id  (HR_ADMIN, SUPER_ADMIN)
const updateDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!department) throw new ApiError(404, 'Department not found');

  await logAction({
    user: req.user,
    action: 'UPDATE_DEPARTMENT',
    entityType: 'Department',
    entityId: department._id,
    description: `Updated department ${department.name}`,
    ip: req.ip,
  });

  return ok(res, { message: 'Department updated successfully', data: department });
});

// DELETE /api/departments/:id  (HR_ADMIN, SUPER_ADMIN)
// Blocked if any designation or employee still references this department,
// to avoid leaving orphaned/dangling references in the database.
const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new ApiError(404, 'Department not found');

  const [designationCount, employeeCount] = await Promise.all([
    Designation.countDocuments({ department: department._id }),
    Employee.countDocuments({ department: department._id }),
  ]);

  if (designationCount > 0 || employeeCount > 0) {
    throw new ApiError(
      409,
      'Cannot delete a department that still has designations or employees assigned to it'
    );
  }

  await department.deleteOne();

  await logAction({
    user: req.user,
    action: 'DELETE_DEPARTMENT',
    entityType: 'Department',
    entityId: department._id,
    description: `Deleted department ${department.name}`,
    ip: req.ip,
  });

  return ok(res, { message: 'Department deleted successfully' });
});

module.exports = { listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment };
