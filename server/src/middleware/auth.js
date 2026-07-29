const { verifyAccessToken } = require('../utils/tokens');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Reads the "Authorization: Bearer <token>" header, verifies the JWT, and
// attaches the current user to req.user. Every protected route uses this.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  const user = await User.findById(payload.sub).populate('employee');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or deactivated');
  }

  req.user = user;
  next();
});

module.exports = authenticate;
