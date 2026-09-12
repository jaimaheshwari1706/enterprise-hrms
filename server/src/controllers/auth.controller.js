const crypto = require('crypto');
const { User, RefreshToken } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const { verifyRefreshToken, hashToken } = require('../utils/tokens');
const { REFRESH_COOKIE_NAME } = require('../utils/cookies');
const {
  issueSession,
  clearSessionCookie,
  consumeRefreshToken,
  revokeFamily,
  revokeAllSessions,
  handleTokenReuse,
  listSessions,
} = require('../services/sessionService');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const env = require('../config/env');

// A bcrypt hash of a throwaway password, compared against when the email
// doesn't exist, so a login for an unknown account takes as long as one
// for a real account (otherwise response timing reveals which emails are
// registered).
const DUMMY_HASH = '$2b$10$lmsKCPDeXBWEOGT9jcD6JeDY3u0mUfdsARgAVEZYeWQo.CucSg566';

function serializeUser(user) {
  return {
    id: user._id,
    email: user.email,
    role: user.role,
    employee: user.employee || null,
  };
}

function minutesLeft(until) {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
}

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email })
    .select('+passwordHash +failedLoginAttempts +lockUntil')
    .populate('employee');

  if (!user || !user.isActive) {
    await comparePassword(password, DUMMY_HASH); // constant-time-ish path
    logger.warn('Login failed: unknown or inactive account', { email, ip: req.ip, requestId: req.id });
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    logger.warn('Login blocked: account locked', { userId: user._id.toString(), ip: req.ip, requestId: req.id });
    throw new ApiError(
      429,
      `Too many failed login attempts. Please try again in ${minutesLeft(user.lockUntil)} minute(s).`,
      null,
      'ACCOUNT_LOCKED'
    );
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const update = { failedLoginAttempts: attempts };
    if (attempts >= env.auth.maxFailedLogins) {
      update.lockUntil = new Date(Date.now() + env.auth.lockoutMinutes * 60 * 1000);
      update.failedLoginAttempts = 0;
    }
    await User.updateOne({ _id: user._id }, update);
    logger.warn('Login failed: wrong password', {
      userId: user._id.toString(),
      ip: req.ip,
      attempts,
      locked: Boolean(update.lockUntil),
      requestId: req.id,
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  // A login starts a brand-new session family.
  const { accessToken } = await issueSession(res, user, req);

  await User.updateOne(
    { _id: user._id },
    { lastLoginAt: new Date(), failedLoginAttempts: 0, lockUntil: null }
  );

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
    throw new ApiError(401, 'No refresh token provided', null, 'NO_REFRESH_TOKEN');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (err) {
    clearSessionCookie(res);
    const expired = err?.name === 'TokenExpiredError';
    throw new ApiError(
      401,
      expired ? 'Your session has expired, please log in again' : 'Invalid refresh token',
      null,
      expired ? 'REFRESH_EXPIRED' : 'REFRESH_INVALID'
    );
  }

  const tokenHash = hashToken(token);

  // Rotate atomically: only one caller can ever successfully revoke a given
  // token (findOneAndUpdate is a single check-and-set at the DB level, so
  // two tabs presenting the same cookie can't both rotate it). A token
  // that was *already* rotated and is presented again is a theft signal:
  // the whole family is revoked (see sessionService.handleTokenReuse).
  const result = await consumeRefreshToken(tokenHash, payload.sub);
  if (result.status === 'retry') {
    logger.info('Refresh token retried within the rotation grace window', { userId: payload.sub, ip: req.ip, requestId: req.id });
  }

  if (result.status !== 'ok' && result.status !== 'retry') {
    clearSessionCookie(res);
    if (result.status === 'reuse') {
      await handleTokenReuse(result.stored, req);
      await logAction({
        user: result.stored.user,
        action: 'REFRESH_TOKEN_REUSE',
        entityType: 'User',
        entityId: result.stored.user,
        description: 'A previously used refresh token was presented again; every session in its family was revoked',
        ip: req.ip,
      });
      throw new ApiError(401, 'This session is no longer valid, please log in again', null, 'REFRESH_REUSE');
    }
    if (result.status === 'expired') {
      throw new ApiError(401, 'Your session has expired, please log in again', null, 'REFRESH_EXPIRED');
    }
    throw new ApiError(401, 'Refresh token is no longer valid, please log in again', null, 'REFRESH_REVOKED');
  }

  const user = await User.findById(payload.sub).populate('employee');
  if (!user || !user.isActive) {
    clearSessionCookie(res);
    throw new ApiError(401, 'Account not found or deactivated', null, 'ACCOUNT_INACTIVE');
  }

  // Continue the same family so reuse of *this* new token can be traced too.
  const { accessToken } = await issueSession(res, user, req, { family: result.stored.family, replaces: result.stored._id });

  return ok(res, {
    message: 'Token refreshed',
    data: { accessToken, user: serializeUser(user) },
  });
});

// POST /api/auth/logout
// Ends this browser's session: the presented refresh token's whole family
// is revoked (there is exactly one live token per family, but revoking by
// family also closes any race with an in-flight rotation).
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (token) {
    const stored = await RefreshToken.findOne({ tokenHash: hashToken(token) }).select('family').lean();
    if (stored) await revokeFamily(stored.family, 'logout');
  }

  clearSessionCookie(res);
  return ok(res, { message: 'Logged out successfully' });
});

// POST /api/auth/logout-all  (authenticated)
// "Sign out everywhere": revokes every refresh token for the account and
// invalidates all access tokens issued so far — including this one, so the
// caller is signed out too and must log in again.
const logoutAll = asyncHandler(async (req, res) => {
  const revoked = await revokeAllSessions(req.user, { reason: 'logout_all' });
  clearSessionCookie(res);

  await logAction({
    user: req.user,
    action: 'LOGOUT_ALL',
    entityType: 'User',
    entityId: req.user._id,
    description: `${req.user.email} signed out of all sessions (${revoked} revoked)`,
    ip: req.ip,
  });

  logger.info('All sessions revoked by user', { userId: req.user._id.toString(), revoked, ip: req.ip, requestId: req.id });
  return ok(res, { message: 'Signed out of all sessions', data: { revoked } });
});

// GET /api/auth/sessions  (authenticated) — active sessions for this account.
const sessions = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const data = await listSessions(req.user._id, token ? hashToken(token) : null);
  return ok(res, { message: 'Active sessions', data });
});

// DELETE /api/auth/sessions/:id  (authenticated) — revoke one session
// (a token family). Only the caller's own sessions can be targeted: the
// family is looked up together with the user id.
const revokeSession = asyncHandler(async (req, res) => {
  const owned = await RefreshToken.exists({ family: req.params.id, user: req.user._id });
  if (!owned) throw new ApiError(404, 'Session not found');
  const revoked = await revokeFamily(req.params.id, 'admin');

  await logAction({
    user: req.user,
    action: 'REVOKE_SESSION',
    entityType: 'User',
    entityId: req.user._id,
    description: `${req.user.email} revoked a session`,
    ip: req.ip,
  });

  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const current = token ? await RefreshToken.exists({ tokenHash: hashToken(token), family: req.params.id }) : null;
  if (current) clearSessionCookie(res);
  return ok(res, { message: 'Session revoked', data: { revoked, current: Boolean(current) } });
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
  const user = await User.findOne({ email, isActive: true });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      {
        passwordResetToken: hashToken(rawToken),
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      }
    );

    const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (err) {
      // Don't reveal delivery problems to the caller; log for operators.
      logger.error('Password reset email failed to send', { userId: user._id.toString(), error: err, requestId: req.id });
    }
    logger.info('Password reset requested', { userId: user._id.toString(), ip: req.ip, requestId: req.id });
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
    throw new ApiError(400, 'Reset link is invalid or has expired', null, 'RESET_TOKEN_INVALID');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  // Invalidate all existing sessions (refresh *and* access tokens) so a
  // stolen password can't keep an old session alive after the reset.
  await revokeAllSessions(user._id, { reason: 'password' });

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
  logoutAll,
  sessions,
  revokeSession,
  me,
  forgotPassword,
  resetPassword,
};
