const { verifyAccessToken } = require('../utils/tokens');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Reads the "Authorization: Bearer <token>" header, verifies the JWT, and
// attaches the current user to req.user. Every protected route uses this.
//
// The user is re-read from the DB on every request (rather than trusting
// the token's claims) so a deactivation, role change or "sign out
// everywhere" takes effect immediately instead of after the access token
// expires.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Authentication required', null, 'AUTH_REQUIRED');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // Distinct code so the client refreshes only on expiry and treats a
    // tampered/invalid token as a hard sign-out.
    const expired = err?.name === 'TokenExpiredError';
    throw new ApiError(401, expired ? 'Access token has expired' : 'Invalid access token', null, expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
  }

  const user = await User.findById(payload.sub).populate('employee');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or deactivated', null, 'ACCOUNT_INACTIVE');
  }

  // Tokens minted before a "sign out everywhere" / password change carry
  // an older version and are dead even though their signature verifies.
  if ((payload.ver || 0) !== (user.tokenVersion || 0)) {
    throw new ApiError(401, 'This session has been signed out', null, 'SESSION_REVOKED');
  }

  req.user = user;
  next();
});

module.exports = authenticate;
