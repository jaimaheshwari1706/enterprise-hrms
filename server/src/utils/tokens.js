const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

// The access token carries just enough to authorize a request without a DB
// lookup: user id + role. It's short-lived (15m) on purpose — if it's
// stolen, the attacker only has a small window to use it.
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry }
  );
}

// The refresh token is long-lived and stored (hashed) in MongoDB so it can
// be revoked (logout, password reset) — a plain JWT alone can't be revoked
// before it expires.
function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

// We never store the raw refresh token in the DB — only its hash. That way
// a leaked database dump doesn't hand out usable refresh tokens.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
