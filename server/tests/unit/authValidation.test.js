const { loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../../src/validations/auth.validation');

describe('auth.validation', () => {
  describe('loginSchema', () => {
    it('accepts a valid email + password', () => {
      expect(loginSchema.safeParse({ email: 'admin@hrms.local', password: 'Admin@123' }).success).toBe(true);
    });

    it('rejects an invalid email', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: '123456' });
      expect(result.success).toBe(false);
    });

    it('rejects a password under 6 characters', () => {
      const result = loginSchema.safeParse({ email: 'a@b.com', password: '123' });
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('accepts a valid email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    });

    it('rejects a missing email', () => {
      expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('accepts a valid token + password', () => {
      expect(resetPasswordSchema.safeParse({ token: 'a'.repeat(20), password: 'newpass123' }).success).toBe(true);
    });

    it('rejects a short token', () => {
      expect(resetPasswordSchema.safeParse({ token: 'short', password: 'newpass123' }).success).toBe(false);
    });
  });
});
