const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} = require('../../src/utils/tokens');

const fakeUser = { _id: { toString: () => '507f1f77bcf86cd799439011' }, role: 'HR_ADMIN' };

describe('tokens', () => {
  it('generates an access token that verifies back to the same user id and role', () => {
    const token = generateAccessToken(fakeUser);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('507f1f77bcf86cd799439011');
    expect(payload.role).toBe('HR_ADMIN');
  });

  it('generates a refresh token that verifies back to the same user id (no role in payload)', () => {
    const token = generateRefreshToken(fakeUser);
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('507f1f77bcf86cd799439011');
    expect(payload.role).toBeUndefined();
  });

  it('rejects an access token when verified as a refresh token (different secrets)', () => {
    const accessToken = generateAccessToken(fakeUser);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = generateAccessToken(fakeUser);
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  describe('hashToken', () => {
    it('is deterministic for the same input', () => {
      expect(hashToken('same-value')).toBe(hashToken('same-value'));
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('value-a')).not.toBe(hashToken('value-b'));
    });

    it('never returns the raw input (so a DB leak does not expose usable tokens)', () => {
      const raw = 'super-secret-refresh-token';
      expect(hashToken(raw)).not.toBe(raw);
    });
  });
});
