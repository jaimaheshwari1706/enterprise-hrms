const { z } = require('zod');
const { strongPassword } = require('./common');

// Login stays lenient on purpose: it must accept whatever password the
// account was created with (accounts provisioned under the older 6-char
// rule still exist). The strong policy applies when a password is *set*.
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is missing or invalid').max(256),
  password: strongPassword('Password'),
});

// Session ids are the refresh-token family (a UUID v4).
const sessionIdParam = z.object({
  id: z.string().regex(/^[0-9a-f-]{36}$/i, 'Invalid session id'),
});

module.exports = { loginSchema, forgotPasswordSchema, resetPasswordSchema, sessionIdParam };
