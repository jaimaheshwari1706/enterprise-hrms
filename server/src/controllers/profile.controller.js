const { User } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { uploadBufferToCloudinary } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const ApiError = require('../utils/ApiError');

// GET /api/profile/me
const getMyProfile = asyncHandler(async (req, res) => {
  return ok(res, {
    message: 'My profile',
    data: {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      employee: req.user.employee || null,
    },
  });
});

// PUT /api/profile/me
// Only touches the linked Employee's personal fields — never job fields.
const updateMyProfile = asyncHandler(async (req, res) => {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }

  const employee = req.user.employee;
  if (req.body.phone !== undefined) employee.phone = req.body.phone;
  if (req.body.dob) employee.dob = req.body.dob;
  if (req.body.address) employee.address = { ...employee.address, ...req.body.address };
  await employee.save();

  await logAction({
    user: req.user,
    action: 'UPDATE_PROFILE',
    entityType: 'Employee',
    entityId: employee._id,
    description: `${employee.firstName} ${employee.lastName} updated their profile`,
    ip: req.ip,
  });

  return ok(res, { message: 'Profile updated successfully', data: employee });
});

// PUT /api/profile/me/password
const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');
  const matches = await comparePassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  await logAction({
    user: req.user,
    action: 'CHANGE_PASSWORD',
    entityType: 'User',
    entityId: user._id,
    description: `${user.email} changed their password`,
    ip: req.ip,
  });

  return ok(res, { message: 'Password changed successfully' });
});

// POST /api/profile/me/avatar
const uploadMyAvatar = asyncHandler(async (req, res) => {
  if (!req.user.employee) {
    throw new ApiError(403, 'No employee profile is linked to this account');
  }
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Attach an image under the "avatar" field.');
  }

  const employee = req.user.employee;
  const result = await uploadBufferToCloudinary(req.file.buffer, 'hrms/employees');
  employee.profileImageUrl = result.secure_url;
  await employee.save();

  return ok(res, { message: 'Profile photo updated', data: employee });
});

module.exports = { getMyProfile, updateMyProfile, changeMyPassword, uploadMyAvatar };
