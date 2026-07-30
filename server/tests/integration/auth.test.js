const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

async function createUser({ email, password, role }) {
  return User.create({ email, passwordHash: await hashPassword(password), role, isActive: true });
}

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials and returns an access token + user', async () => {
      await createUser({ email: 'hr@test.com', password: 'Admin@123', role: 'HR_ADMIN' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'hr@test.com', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('hr@test.com');
      expect(res.body.data.user.role).toBe('HR_ADMIN');
      // Refresh token must be set as an httpOnly cookie, not in the JSON body.
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    });

    it('rejects an incorrect password with 401', async () => {
      await createUser({ email: 'hr@test.com', password: 'Admin@123', role: 'HR_ADMIN' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'hr@test.com', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects login for a non-existent email with 401 (not 404 — avoids leaking which emails exist)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'Admin@123' });

      expect(res.status).toBe(401);
    });

    it('rejects a malformed request with 422 (Zod validation)', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(422);
    });

    it('rejects login for a deactivated account', async () => {
      const user = await createUser({ email: 'inactive@test.com', password: 'Admin@123', role: 'EMPLOYEE' });
      user.isActive = false;
      await user.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'inactive@test.com', password: 'Admin@123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects a request with no Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the current user for a valid access token', async () => {
      await createUser({ email: 'hr@test.com', password: 'Admin@123', role: 'HR_ADMIN' });
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'hr@test.com', password: 'Admin@123' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('hr@test.com');
    });

    it('rejects a garbage/invalid token', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });
});
