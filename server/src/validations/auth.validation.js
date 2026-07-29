const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is missing or invalid'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

module.exports = { loginSchema, forgotPasswordSchema, resetPasswordSchema };
