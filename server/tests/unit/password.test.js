const { hashPassword, comparePassword } = require('../../src/utils/password');

describe('password', () => {
  it('hashes a password to a bcrypt hash, not the plain value', async () => {
    const hash = await hashPassword('Admin@123');
    expect(hash).not.toBe('Admin@123');
    expect(hash.startsWith('$2b$') || hash.startsWith('$2a$')).toBe(true);
  });

  it('comparePassword returns true for the correct password', async () => {
    const hash = await hashPassword('Admin@123');
    await expect(comparePassword('Admin@123', hash)).resolves.toBe(true);
  });

  it('comparePassword returns false for an incorrect password', async () => {
    const hash = await hashPassword('Admin@123');
    await expect(comparePassword('WrongPassword', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt) even for the same input', async () => {
    const hash1 = await hashPassword('Admin@123');
    const hash2 = await hashPassword('Admin@123');
    expect(hash1).not.toBe(hash2);
  });
});
