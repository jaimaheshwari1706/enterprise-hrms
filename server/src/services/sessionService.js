// Refresh-token session management, shared by auth (login / refresh /
// logout / sign out everywhere / password reset), profile (password change)
// and employee deactivation so every path revokes sessions the same way.
const crypto = require('crypto');
const { RefreshToken, User } = require('../models');
const { generateAccessToken, generateRefreshToken, getTokenExpiry, hashToken } = require('../utils/tokens');
const { REFRESH_COOKIE_NAME, refreshCookieOptions } = require('../utils/cookies');
const logger = require('../utils/logger');

const USER_AGENT_MAX = 200;

function clientUserAgent(req) {
  return String(req.get?.('user-agent') || '').slice(0, USER_AGENT_MAX);
}

// Issues a fresh access + refresh token pair, persists the refresh token
// (hashed) and sets it as an httpOnly cookie. A new `family` starts a new
// session (login); passing an existing family continues one (rotation).
// The DB row and the cookie both use the JWT's own expiry so
// JWT_REFRESH_EXPIRY is the single source of truth.
async function issueSession(res, user, req, { family = null, replaces = null } = {}) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const expiresAt = getTokenExpiry(refreshToken);
  const tokenHash = hashToken(refreshToken);
  const sessionFamily = family || crypto.randomUUID();

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    family: sessionFamily,
    expiresAt,
    createdByIp: req.ip,
    userAgent: clientUserAgent(req),
  });
  if (replaces) {
    await RefreshToken.updateOne({ _id: replaces }, { replacedByHash: tokenHash });
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(expiresAt));
  return { accessToken, refreshToken, family: sessionFamily, tokenHash };
}

function clearSessionCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

// Atomically consumes a refresh token for rotation. Returns:
//   { status: 'ok', stored }       the token was live and is now revoked
//   { status: 'reuse', stored }    it had already been rotated/revoked → theft signal
//   { status: 'expired' }          it exists but has expired
//   { status: 'unknown' }          never issued (or already purged)
async function consumeRefreshToken(tokenHash, userId) {
  const now = new Date();
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash, user: userId, revokedAt: null, expiresAt: { $gt: now } },
    { revokedAt: now, revokedReason: 'rotated' }
  );
  if (stored) return { status: 'ok', stored };

  const existing = await RefreshToken.findOne({ tokenHash, user: userId }).lean();
  if (!existing) return { status: 'unknown' };
  if (existing.expiresAt <= now && !existing.revokedAt) return { status: 'expired' };
  return { status: 'reuse', stored: existing };
}

async function revokeFamily(family, reason) {
  const result = await RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
  return result.modifiedCount;
}

// Revokes every refresh token for a user and bumps the user's tokenVersion
// so every access token issued so far is rejected too — no other device
// can keep going until its access token expires. Accepts a User document
// (its tokenVersion is updated in place so a session issued right after
// carries the new version) or a plain id.
async function revokeAllSessions(userOrId, { reason = 'logout_all' } = {}) {
  const userId = userOrId?._id || userOrId;
  const result = await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
  const updated = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true }).select('tokenVersion').lean();
  if (userOrId && typeof userOrId === 'object' && updated) userOrId.tokenVersion = updated.tokenVersion;
  return result.modifiedCount;
}

// Reuse of a rotated token: kill the entire family so both the legitimate
// client and whoever replayed the token are signed out.
async function handleTokenReuse(stored, req) {
  const revoked = await revokeFamily(stored.family, 'reuse');
  logger.warn('Refresh token reuse detected — session family revoked', {
    userId: stored.user.toString(),
    family: stored.family,
    revokedTokens: revoked,
    ip: req.ip,
    requestId: req.id,
  });
  return revoked;
}

// Active sessions for a user: one row per live refresh token (rotation
// keeps exactly one live token per family).
async function listSessions(userId, currentTokenHash = null) {
  const rows = await RefreshToken.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean();
  if (rows.length === 0) return [];
  // When each family started (its first token = the login), since the live
  // row only tells us when it was last rotated.
  const starts = await RefreshToken.aggregate([
    { $match: { family: { $in: rows.map((r) => r.family) } } },
    { $group: { _id: '$family', startedAt: { $min: '$createdAt' } } },
  ]);
  const startedAt = new Map(starts.map((s) => [s._id, s.startedAt]));
  return rows.map((row) => ({
    id: row.family,
    createdAt: startedAt.get(row.family) || row.createdAt,
    lastActiveAt: row.createdAt,
    expiresAt: row.expiresAt,
    ip: row.createdByIp,
    userAgent: row.userAgent,
    current: Boolean(currentTokenHash && row.tokenHash === currentTokenHash),
  }));
}

module.exports = {
  issueSession,
  clearSessionCookie,
  consumeRefreshToken,
  revokeFamily,
  revokeAllSessions,
  handleTokenReuse,
  listSessions,
};
