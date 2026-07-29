const mongoose = require('mongoose');

// We store a HASH of the refresh token, never the raw value. This lets us
// revoke sessions (logout, "log out everywhere") without keeping sensitive
// raw tokens sitting in the database.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    createdByIp: { type: String, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
