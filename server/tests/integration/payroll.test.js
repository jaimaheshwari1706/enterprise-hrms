const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Employee, Department, Designation } = require('../../src/models');
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
let employee;

beforeEach(async () => {
  const passwordHash = await hashPassword('Admin@123');
  await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });

  employee = await Employee.create({
    employeeId: 'EMP0001', firstName: 'John', lastName: 'Doe', email: 'john@test.com',
    joiningDate: new Date('2025-01-01T00:00:00Z'), department: dept._id, designation: designation._id, status: 'active',
  });

  hrToken = (await request(app).post('/api/auth/login').send({ email: 'hr@test.com', password: 'Admin@123' })).body.data.accessToken;
});

describe('Payroll generation', () => {
  it('skips employees with no configured salary structure', async () => {
    const res = await request(app)
      .post('/api/payroll/generate')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ month: '2026-08' });

    expect(res.status).toBe(201);
    expect(res.body.data.generated).toHaveLength(0);
    expect(res.body.data.skipped).toHaveLength(1);
    expect(res.body.data.skipped[0].reason).toMatch(/no salary/i);
  });

  it('generates a payroll record with correct gross/net salary once a salary is configured', async () => {
    await request(app)
      .put(`/api/payroll/salary/${employee._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ basic: 50000, hra: 20000, allowances: 5000, deductions: 3000 });

    const res = await request(app)
      .post('/api/payroll/generate')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ month: '2026-08' });

    expect(res.status).toBe(201);
    expect(res.body.data.generated).toHaveLength(1);
    expect(res.body.data.generated[0].grossSalary).toBe(75000);
    expect(res.body.data.generated[0].netSalary).toBe(72000);
    expect(res.body.data.generated[0].status).toBe('Draft');
  });

  it('does not duplicate a payroll record for the same employee+month on a second run', async () => {
    await request(app)
      .put(`/api/payroll/salary/${employee._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ basic: 50000, hra: 20000, allowances: 5000, deductions: 3000 });

    await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08' });
    const secondRun = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08' });

    expect(secondRun.body.data.generated).toHaveLength(0);
    expect(secondRun.body.data.skipped[0].reason).toMatch(/already generated/i);
  });

  it('progresses payroll status Draft -> Processed -> Paid', async () => {
    await request(app)
      .put(`/api/payroll/salary/${employee._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ basic: 50000, hra: 20000, allowances: 5000, deductions: 3000 });

    const generateRes = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08' });
    const payrollId = generateRes.body.data.generated[0]._id;

    const processedRes = await request(app)
      .patch(`/api/payroll/${payrollId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Processed' });
    expect(processedRes.body.data.status).toBe('Processed');

    const paidRes = await request(app)
      .patch(`/api/payroll/${payrollId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'Paid' });
    expect(paidRes.body.data.status).toBe('Paid');
  });

  it('rejects negative salary values with a 422', async () => {
    const res = await request(app)
      .put(`/api/payroll/salary/${employee._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ basic: -1000, hra: 0, allowances: 0, deductions: 0 });

    expect(res.status).toBe(422);
  });
});
