const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, RefreshToken } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');
const { hashToken } = require('../../src/utils/tokens');
const env = require('../../src/config/env');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

afterEach(async () => {
  await clearTestDB();
  env.auth.refreshReuseGraceSeconds = 30;
});

// Most tests exercise strict rotation (any reuse = theft). The grace-window
// behaviour for a lost rotation response is covered explicitly in 3a.
beforeEach(() => {
  env.auth.refreshReuseGraceSeconds = 0;
});

const PASSWORD = 'Admin@123';

async function createUser(email = 'user@test.com', role = 'HR_ADMIN') {
  return User.create({ email, passwordHash: await hashPassword(PASSWORD), role, isActive: true });
}

// Pulls the refresh cookie out of a response so it can be replayed.
function cookieOf(res) {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith('refreshToken='));
  return raw ? raw.split(';')[0] : null;
}
function rawTokenOf(cookie) {
  return decodeURIComponent(cookie.replace('refreshToken=', ''));
}

async function login(email = 'user@test.com') {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return { accessToken: res.body.data.accessToken, cookie: cookieOf(res), res };
}

const refresh = (cookie) => request(app).post('/api/auth/refresh-token').set('Cookie', cookie);
const me = (accessToken) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

describe('Refresh token sessions', () => {
  it('1. a normal refresh returns a new access token and a new cookie', async () => {
    await createUser();
    const session = await login();

    const res = await refresh(session.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('user@test.com');
    const nextCookie = cookieOf(res);
    expect(nextCookie).toBeTruthy();
    expect(nextCookie).not.toBe(session.cookie);
    expect((await me(res.body.data.accessToken)).status).toBe(200);
  });

  it('2. rotation keeps one live token per family and links old → new', async () => {
    const user = await createUser();
    const session = await login();
    const rotated = await refresh(session.cookie);

    const rows = await RefreshToken.find({ user: user._id }).sort({ createdAt: 1 }).lean();
    expect(rows).toHaveLength(2);
    expect(rows[0].family).toBe(rows[1].family);
    expect(rows[0].revokedAt).not.toBeNull();
    expect(rows[0].revokedReason).toBe('rotated');
    expect(rows[0].replacedByHash).toBe(rows[1].tokenHash);
    expect(rows[1].revokedAt).toBeNull();
    expect(rows[1].tokenHash).toBe(hashToken(rawTokenOf(cookieOf(rotated))));
  });

  it('3. reusing an already-rotated token revokes the whole family (the new token dies too)', async () => {
    const user = await createUser();
    const session = await login();
    const rotated = await refresh(session.cookie);
    const freshCookie = cookieOf(rotated);

    // Attacker (or a stale tab) replays the old cookie.
    const replay = await refresh(session.cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_REUSE');
    expect(replay.headers['set-cookie'][0]).toMatch(/refreshToken=;/);

    // The legitimate, newer token is now dead as well.
    const legit = await refresh(freshCookie);
    expect(legit.status).toBe(401);
    expect(['REFRESH_REVOKED', 'REFRESH_REUSE']).toContain(legit.body.code);

    const live = await RefreshToken.countDocuments({ user: user._id, revokedAt: null });
    expect(live).toBe(0);
    const reuseRows = await RefreshToken.countDocuments({ user: user._id, revokedReason: 'reuse' });
    expect(reuseRows).toBeGreaterThanOrEqual(1);
  });

  it('3a. within the grace window a lost rotation response can be retried (the previous live token dies)', async () => {
    env.auth.refreshReuseGraceSeconds = 30;
    const user = await createUser();
    const session = await login();
    const rotated = await refresh(session.cookie); // response "lost" by the client
    const lostCookie = cookieOf(rotated);

    const retry = await refresh(session.cookie); // browser still holds the old cookie
    expect(retry.status).toBe(200);
    const retryCookie = cookieOf(retry);
    expect(retryCookie).not.toBe(lostCookie);

    // Exactly one live token in the family: the retried one.
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(1);
    expect(await RefreshToken.countDocuments({ user: user._id, tokenHash: hashToken(rawTokenOf(retryCookie)), revokedAt: null })).toBe(1);
    expect(await RefreshToken.countDocuments({ user: user._id, tokenHash: hashToken(rawTokenOf(lostCookie)), revokedAt: { $ne: null } })).toBe(1);
    expect((await refresh(retryCookie)).status).toBe(200);

    // A third presentation of the very first cookie is no longer "the
    // immediately previous token" → real reuse → family revoked.
    const replay = await refresh(session.cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('REFRESH_REUSE');
    expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBe(0);
  });

  it('3b. reuse in one family does not touch another device\'s session', async () => {
    await createUser();
    const laptop = await login();
    const phone = await login();
    const laptopRotated = await refresh(laptop.cookie);
    expect(laptopRotated.status).toBe(200);
    await refresh(laptop.cookie); // replay → laptop family revoked

    const phoneStillWorks = await refresh(phone.cookie);
    expect(phoneStillWorks.status).toBe(200);
  });

  it('4. logout revokes the presented session and clears the cookie; the access token still expires naturally', async () => {
    await createUser();
    const session = await login();

    const out = await request(app).post('/api/auth/logout').set('Cookie', session.cookie);
    expect(out.status).toBe(200);
    expect(out.headers['set-cookie'][0]).toMatch(/refreshToken=;/);

    const again = await refresh(session.cookie);
    expect(again.status).toBe(401);
    expect(again.body.code).toBe('REFRESH_REUSE'); // revoked token presented again
  });

  it('5. sign out everywhere kills every refresh token AND every outstanding access token', async () => {
    await createUser();
    const laptop = await login();
    const phone = await login();
    expect((await me(phone.accessToken)).status).toBe(200);

    const res = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .set('Cookie', laptop.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(2);

    // Neither device can refresh…
    expect((await refresh(laptop.cookie)).status).toBe(401);
    expect((await refresh(phone.cookie)).status).toBe(401);
    // …and their still-unexpired access tokens are rejected immediately.
    const phoneMe = await me(phone.accessToken);
    expect(phoneMe.status).toBe(401);
    expect(phoneMe.body.code).toBe('SESSION_REVOKED');
    expect((await me(laptop.accessToken)).status).toBe(401);

    // A new login works and gets a token with the bumped version.
    const fresh = await login();
    expect((await me(fresh.accessToken)).status).toBe(200);
  });

  it('6. changing the password ends other sessions but keeps the current browser signed in', async () => {
    await createUser();
    const laptop = await login();
    const phone = await login();

    const res = await request(app)
      .put('/api/profile/me/password')
      .set('Authorization', `Bearer ${laptop.accessToken}`)
      .set('Cookie', laptop.cookie)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass@456' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    const newCookie = cookieOf(res);
    expect(newCookie).toBeTruthy();

    // Old access tokens (both devices) are dead; the returned one works.
    expect((await me(laptop.accessToken)).status).toBe(401);
    expect((await me(phone.accessToken)).status).toBe(401);
    expect((await me(res.body.data.accessToken)).status).toBe(200);

    // Phone can't refresh; the laptop's *new* cookie can.
    expect((await refresh(phone.cookie)).status).toBe(401);
    expect((await refresh(newCookie)).status).toBe(200);

    // And the new password is required from now on.
    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'NewPass@456' });
    expect(newLogin.status).toBe(200);
  });

  it('6b. a password reset via emailed token revokes every session', async () => {
    const user = await createUser();
    const session = await login();
    const raw = 'a'.repeat(40);
    await User.updateOne({ _id: user._id }, { passwordResetToken: hashToken(raw), passwordResetExpires: new Date(Date.now() + 60000) });

    const res = await request(app).post('/api/auth/reset-password').send({ token: raw, password: 'Reset@789' });
    expect(res.status).toBe(200);
    expect((await refresh(session.cookie)).status).toBe(401);
    expect((await me(session.accessToken)).status).toBe(401);
  });

  it('7. an expired refresh token is rejected with REFRESH_EXPIRED and the cookie cleared', async () => {
    const user = await createUser();
    const expired = jwt.sign({ sub: user._id.toString(), jti: 'x' }, env.jwt.refreshSecret, { expiresIn: -10 });
    const res = await refresh(`refreshToken=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_EXPIRED');
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
  });

  it('7b. a refresh token whose DB row has expired is rejected even if the JWT is still valid', async () => {
    const user = await createUser();
    const session = await login();
    await RefreshToken.updateOne({ user: user._id }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await refresh(session.cookie);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_EXPIRED');
  });

  it('rejects a refresh token signed with the wrong secret or missing entirely', async () => {
    const user = await createUser();
    const forged = jwt.sign({ sub: user._id.toString() }, 'not-the-secret', { expiresIn: '1h' });
    const res = await refresh(`refreshToken=${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('REFRESH_INVALID');
    const none = await request(app).post('/api/auth/refresh-token');
    expect(none.body.code).toBe('NO_REFRESH_TOKEN');
  });

  it('lists active sessions and lets the user revoke one of them', async () => {
    await createUser();
    const laptop = await login();
    const phone = await login();

    const list = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${laptop.accessToken}`).set('Cookie', laptop.cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    const current = list.body.data.find((s) => s.current);
    const other = list.body.data.find((s) => !s.current);
    expect(current).toBeDefined();
    expect(other).toBeDefined();
    // No token material is ever returned.
    for (const s of list.body.data) {
      expect(s.tokenHash).toBeUndefined();
      expect(JSON.stringify(s)).not.toMatch(/refreshToken/);
    }

    const revoke = await request(app).delete(`/api/auth/sessions/${other.id}`).set('Authorization', `Bearer ${laptop.accessToken}`);
    expect(revoke.status).toBe(200);
    expect((await refresh(phone.cookie)).status).toBe(401);
    expect((await refresh(laptop.cookie)).status).toBe(200);
  });

  it('cannot revoke another user\'s session', async () => {
    const victim = await createUser('victim@test.com', 'EMPLOYEE');
    await createUser('attacker@test.com', 'EMPLOYEE');
    await login('victim@test.com');
    const attacker = await login('attacker@test.com');
    const victimFamily = (await RefreshToken.findOne({ user: victim._id }).lean()).family;

    const res = await request(app).delete(`/api/auth/sessions/${victimFamily}`).set('Authorization', `Bearer ${attacker.accessToken}`);
    expect(res.status).toBe(404);
    expect(await RefreshToken.countDocuments({ user: victim._id, revokedAt: null })).toBe(1);
  });

  it('deactivating an employee revokes their sessions immediately', async () => {
    // Covered functionally by the employee status endpoint; here we assert the
    // primitive: revokeAllSessions bumps tokenVersion so old access tokens die.
    const user = await createUser();
    const session = await login();
    const { revokeAllSessions } = require('../../src/services/sessionService');
    await revokeAllSessions(user._id, { reason: 'admin' });
    expect((await me(session.accessToken)).body.code).toBe('SESSION_REVOKED');
    expect((await refresh(session.cookie)).status).toBe(401);
  });
});
