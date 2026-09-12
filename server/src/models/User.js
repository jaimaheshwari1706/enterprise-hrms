const mongoose = require('mongoose');

// User = login identity (email/password/role).
// Employee = HR profile (department, designation, salary...).
// Keeping them separate means SUPER_ADMIN/HR_ADMIN accounts can exist
// without needing a full employee record, and it mirrors how most real
// HRMS/SaaS systems separate "auth" from "HR data".
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never return this field unless explicitly requested
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'],
      required: true,
      default: 'EMPLOYEE',
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
    // Per-account brute-force protection: after N consecutive failures the
    // account is locked until `lockUntil`. Reset on successful login.
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },
    // Embedded in every access token as `ver`. Bumped by "sign out
    // everywhere", password change/reset and deactivation, so access tokens
    // minted before the bump are rejected even though their signature is
    // still valid (a plain timestamp comparison would be ambiguous within
    // the same second because JWT iat is second-granular).
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
