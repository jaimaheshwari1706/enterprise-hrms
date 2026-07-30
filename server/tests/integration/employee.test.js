const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Department, Designation } = require('../../src/models');
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

let hrToken;
let department;
let designation;

beforeEach(async () => {
  const passwordHash = await hashPassword('Admin@123');
  await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  department = await Department.create({ name: 'Engineering', code: 'ENG' });
  designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: department._id });

  const loginRes = await request(app).post('/api/auth/login').send({ email: 'hr@test.com', password: 'Admin@123' });
  hrToken = loginRes.body.data.accessToken;
});

describe('Employee API', () => {
  it('creates an employee and provisions a linked login', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        joiningDate: '2024-01-15',
        department: department._id.toString(),
        designation: designation._id.toString(),
        gender: 'Male',
        employmentType: 'Full-Time',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.employeeId).toBe('EMP0001');
    expect(res.body.data.email).toBe('john.doe@test.com');

    // A login should now exist for this email.
    const user = await User.findOne({ email: 'john.doe@test.com' });
    expect(user).not.toBeNull();
    expect(user.role).toBe('EMPLOYEE');
  });

  it('rejects creating an employee with a duplicate email with a 409', async () => {
    const payload = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'dupe@test.com',
      joiningDate: '2024-01-15',
      department: department._id.toString(),
      designation: designation._id.toString(),
    };

    const first = await request(app).post('/api/employees').set('Authorization', `Bearer ${hrToken}`).send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/employees').set('Authorization', `Bearer ${hrToken}`).send(payload);
    expect(second.status).toBe(409);
  });

  it('paginates the employee list correctly', async () => {
    for (let i = 1; i <= 15; i++) {
      await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          firstName: `Employee${i}`,
          lastName: 'Test',
          email: `employee${i}@test.com`,
          joiningDate: '2024-01-15',
          department: department._id.toString(),
          designation: designation._id.toString(),
        });
    }

    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .query({ page: 2, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5); // 15 total, page 2 of 10 -> 5 remaining
    expect(res.body.pagination).toEqual({ page: 2, limit: 10, total: 15, pages: 2 });
  });

  it('deactivating an employee also disables their login', async () => {
    const createRes = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@test.com',
        joiningDate: '2024-01-15',
        department: department._id.toString(),
        designation: designation._id.toString(),
      });

    const employeeId = createRes.body.data._id;

    const statusRes = await request(app)
      .patch(`/api/employees/${employeeId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'inactive' });

    expect(statusRes.status).toBe(200);

    const user = await User.findOne({ email: 'jane.doe@test.com' });
    expect(user.isActive).toBe(false);

    // That employee should no longer be able to log in.
    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jane.doe@test.com', password: 'irrelevant-since-random-temp-password' });
    expect(loginAttempt.status).toBe(401);
  });
});
