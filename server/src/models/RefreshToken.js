const mongoose = require('mongoose');

// We store a HASH of the refresh token, never the raw value. This lets us
// revoke sessions (logout, "sign out everywhere") without keeping sensitive
// raw tokens sitting in the database.
//
// Token *families*: every login starts a family; every rotation issues a
// new token in the same family and revokes the old one. If a token that
// was already rotated is presented again, someone other than the legitimate
// client has a copy (cookie theft) — the whole family is revoked, ending
// both the attacker's and the victim's session so the victim re-logs in.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdByIp: { type: String, default: null },
    userAgent: { type: String, default: '' },
    revokedAt: { type: Date, default: null },
    // Hash of the token that replaced this one on rotation (audit trail).
    replacedByHash: { type: String, default: null },
    // Why it was revoked: 'rotated' | 'logout' | 'logout_all' | 'password' |
    // 'reuse' | 'admin' — informational only.
    revokedReason: { type: String, default: null },
  },
  { timestamps: true }
);

// MongoDB purges documents once `expiresAt` passes — the collection would
// otherwise grow by one row per login/refresh forever. Expired tokens are
// already rejected by the refresh handler, so this changes nothing
// functionally; it just keeps the table small.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Family-wide revocation and the per-user session list / bulk revocation
// (the {user,...} compound index also serves plain lookups by user).
refreshTokenSchema.index({ family: 1, revokedAt: 1 });
refreshTokenSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
