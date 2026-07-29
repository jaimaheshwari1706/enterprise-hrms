const crypto = require('crypto');
const { User, RefreshToken } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/tokens');
const { REFRESH_COOKIE_NAME, refreshCookieOptions } = require('../utils/cookies');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { sendPasswordResetEmail } = require('../services/emailService');
const env = require('../config/env');

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
    employee: user.employee || null,
  };
}

// Issues a fresh access + refresh token pair, persists the refresh token
// (hashed) in Mongo so it can be revoked later, and sets it as an httpOnly
// cookie. Used by both /login and /refresh-token.
async function issueTokens(res, user, req) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdByIp: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return accessToken;
}

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash').populate('employee');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const accessToken = await issueTokens(res, user, req);

  user.lastLoginAt = new Date();
  await user.save();

  await logAction({
    user,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user._id,
    description: `${user.email} logged in`,
    ip: req.ip,
  });

  return ok(res, {
    message: 'Login successful',
    data: { user: serializeUser(user), accessToken },
  });
});

// POST /api/auth/refresh-token
// Reads the refresh token from the httpOnly cookie, validates it against
// the DB (not revoked, not expired), rotates it (old one revoked, new one
// issued), and returns a fresh access token.
const refreshTokenHandler = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new ApiError(401, 'No refresh token provided');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(token);
  const stored = await RefreshToken.findOne({ tokenHash, user: payload.sub });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token is no longer valid, please log in again');
  }

  const user = await User.findById(payload.sub).populate('employee');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Account not found or deactivated');
  }

  // Rotate: revoke the used refresh token and issue a brand new pair. This
  // limits the damage if a refresh token is ever stolen — it only works once.
  stored.revokedAt = new Date();
  await stored.save();

  const accessToken = await issueTokens(res, user, req);

  return ok(res, {
    message: 'Token refreshed',
    data: { accessToken, user: serializeUser(user) },
  });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (token) {
    const tokenHash = hashToken(token);
    await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
  }

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  return ok(res, { message: 'Logged out successfully' });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  return ok(res, { message: 'Current user', data: { user: serializeUser(req.user) } });
});

// POST /api/auth/forgot-password
// Always responds with a generic success message (even if the email
// doesn't exist) so this endpoint can't be used to enumerate registered
// emails.
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  return ok(res, {
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
});

// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw new ApiError(400, 'Reset link is invalid or has expired');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  // Invalidate all existing sessions so a stolen password can't keep an
  // old refresh token alive after the password has been changed.
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });

  await logAction({
    user,
    action: 'RESET_PASSWORD',
    entityType: 'User',
    entityId: user._id,
    description: `${user.email} reset their password`,
    ip: req.ip,
  });

  return ok(res, { message: 'Password has been reset successfully. Please log in again.' });
});

module.exports = {
  login,
  refreshTokenHandler,
  logout,
  me,
  forgotPassword,
  resetPassword,
};
