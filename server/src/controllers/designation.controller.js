const { Designation, Employee, Department } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta, getSort } = require('../utils/pagination');
const { containsRegex } = require('../utils/regex');
const { logAction } = require('../services/auditService');
const { DESIGNATION_SORT_FIELDS } = require('../validations/designation.validation');
const ApiError = require('../utils/ApiError');

async function assertDepartmentExists(department) {
  const exists = await Department.exists({ _id: department });
  if (!exists) throw new ApiError(422, 'Validation failed', ['department: Department not found']);
}

// GET /api/designations?page=&limit=&search=&department=&status=
const listDesignations = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sort = getSort(req.query, DESIGNATION_SORT_FIELDS, { createdAt: -1 });
  const { search, department, status } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (search) {
    const regex = containsRegex(search);
    filter.$or = [{ name: regex }, { code: regex }];
  }

  const [data, total] = await Promise.all([
    Designation.find(filter)
      .populate('department', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Designation.countDocuments(filter),
  ]);

  return ok(res, { message: 'Designations fetched', data, pagination: buildPaginationMeta(page, limit, total) });
});

// GET /api/designations/:id
const getDesignation = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id).populate('department', 'name code');
  if (!designation) throw new ApiError(404, 'Designation not found');
  return ok(res, { message: 'Designation fetched', data: designation });
});

// POST /api/designations  (HR_ADMIN, SUPER_ADMIN)
const createDesignation = asyncHandler(async (req, res) => {
  await assertDepartmentExists(req.body.department);
  const designation = await Designation.create(req.body);

  await logAction({
    user: req.user,
    action: 'CREATE_DESIGNATION',
    entityType: 'Designation',
    entityId: designation._id,
    description: `Created designation ${designation.name}`,
    ip: req.ip,
  });

  return created(res, { message: 'Designation created successfully', data: designation });
});

// PUT /api/designations/:id  (HR_ADMIN, SUPER_ADMIN)
const updateDesignation = asyncHandler(async (req, res) => {
  await assertDepartmentExists(req.body.department);
  const designation = await Designation.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!designation) throw new ApiError(404, 'Designation not found');

  await logAction({
    user: req.user,
    action: 'UPDATE_DESIGNATION',
    entityType: 'Designation',
    entityId: designation._id,
    description: `Updated designation ${designation.name}`,
    ip: req.ip,
  });

  return ok(res, { message: 'Designation updated successfully', data: designation });
});

// DELETE /api/designations/:id  (HR_ADMIN, SUPER_ADMIN)
const deleteDesignation = asyncHandler(async (req, res) => {
  const designation = await Designation.findById(req.params.id);
  if (!designation) throw new ApiError(404, 'Designation not found');

  const employeeCount = await Employee.countDocuments({ designation: designation._id });
  if (employeeCount > 0) {
    throw new ApiError(409, 'Cannot delete a designation that still has employees assigned to it');
  }

  await designation.deleteOne();

  await logAction({
    user: req.user,
    action: 'DELETE_DESIGNATION',
    entityType: 'Designation',
    entityId: designation._id,
    description: `Deleted designation ${designation.name}`,
    ip: req.ip,
  });

  return ok(res, { message: 'Designation deleted successfully' });
});

module.exports = {
  listDesignations,
  getDesignation,
  createDesignation,
  updateDesignation,
  deleteDesignation,
};
