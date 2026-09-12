const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Employee, Department, Designation, LeaveType, LeaveRequest, Salary, Organization } = require('../../src/models');
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

const PASSWORD = 'Admin@123';
async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.data.accessToken;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function seed() {
  const passwordHash = await hashPassword(PASSWORD);
  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });
  const leaveType = await LeaveType.create({ name: 'Casual Leave', defaultDaysPerYear: 12 });
  await Organization.create({ name: 'Acme' });
  await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  const mk = async (id, first, role, extra = {}) => {
    const emp = await Employee.create({ employeeId: id, firstName: first, lastName: 'X', email: `${first.toLowerCase()}@test.com`, joiningDate: new Date('2025-01-01'), department: dept._id, designation: designation._id, ...extra });
    const user = await User.create({ email: emp.email, passwordHash, role, employee: emp._id });
    emp.user = user._id;
    await emp.save();
    return emp;
  };
  const manager = await mk('EMP0001', 'Mia', 'MANAGER');
  const report = await mk('EMP0002', 'Rita', 'EMPLOYEE', { manager: manager._id });
  const outsider = await mk('EMP0003', 'Oscar', 'EMPLOYEE');
  const outsiderManager = await mk('EMP0004', 'Omar', 'MANAGER');
  await Salary.create({ employee: outsider._id, basic: 90000, hra: 0, allowances: 0, deductions: 0 });
  const outsiderLeave = await LeaveRequest.create({ employee: outsider._id, leaveType: leaveType._id, startDate: new Date('2026-08-03'), endDate: new Date('2026-08-04'), days: 2, reason: 'x', status: 'Pending' });
  return { dept, designation, leaveType, manager, report, outsider, outsiderManager, outsiderLeave };
}

describe('Authorization boundaries (IDOR / RBAC bypass)', () => {
  it('an employee cannot read a colleague\'s salary or payroll', async () => {
    const ctx = await seed();
    const token = await login('rita@test.com');
    const salary = await request(app).get(`/api/payroll/salary/${ctx.outsider._id}`).set(auth(token));
    expect(salary.status).toBe(403);
    const list = await request(app).get('/api/payroll').set(auth(token));
    expect(list.status).toBe(403);
    const salaries = await request(app).get('/api/payroll/salaries').set(auth(token));
    expect(salaries.status).toBe(403);
    const ownSalary = await request(app).get(`/api/payroll/salary/${ctx.report._id}`).set(auth(token));
    expect(ownSalary.status).toBe(200);
  });

  it('a manager cannot approve a leave request from someone outside their team', async () => {
    const ctx = await seed();
    const token = await login('mia@test.com');
    const res = await request(app).patch(`/api/leaves/${ctx.outsiderLeave._id}/approve`).set(auth(token)).send({});
    expect(res.status).toBe(403);
    const still = await LeaveRequest.findById(ctx.outsiderLeave._id).lean();
    expect(still.status).toBe('Pending');
  });

  it('an employee cannot approve or list leave requests at all', async () => {
    const ctx = await seed();
    const token = await login('rita@test.com');
    expect((await request(app).patch(`/api/leaves/${ctx.outsiderLeave._id}/approve`).set(auth(token)).send({})).status).toBe(403);
    expect((await request(app).get('/api/leaves').set(auth(token))).status).toBe(403);
  });

  it('an employee cannot read team attendance, another employee\'s attendance, or the HR dashboard', async () => {
    const ctx = await seed();
    const token = await login('rita@test.com');
    expect((await request(app).get('/api/attendance').set(auth(token))).status).toBe(403);
    expect((await request(app).get(`/api/attendance?employee=${ctx.outsider._id}`).set(auth(token))).status).toBe(403);
    expect((await request(app).get('/api/dashboard/hr').set(auth(token))).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set(auth(token))).status).toBe(403);
  });

  it('a manager cannot query attendance or leave for an employee outside their team', async () => {
    const ctx = await seed();
    const token = await login('mia@test.com');
    expect((await request(app).get(`/api/attendance?employee=${ctx.outsider._id}`).set(auth(token))).status).toBe(403);
    expect((await request(app).get(`/api/leaves?employee=${ctx.outsider._id}`).set(auth(token))).status).toBe(403);
    const ok = await request(app).get(`/api/leaves?employee=${ctx.report._id}`).set(auth(token));
    expect(ok.status).toBe(200);
  });

  it('an employee cannot manage employees, organization, leave types or payroll generation', async () => {
    const ctx = await seed();
    const token = await login('rita@test.com');
    expect((await request(app).put(`/api/employees/${ctx.outsider._id}`).set(auth(token)).send({ firstName: 'Hacked' })).status).toBe(403);
    expect((await request(app).patch(`/api/employees/${ctx.outsider._id}/status`).set(auth(token)).send({ status: 'inactive' })).status).toBe(403);
    expect((await request(app).put('/api/organization').set(auth(token)).send({ name: 'Evil Corp' })).status).toBe(403);
    expect((await request(app).post('/api/leaves/leave-types').set(auth(token)).send({ name: 'X', defaultDaysPerYear: 99 })).status).toBe(403);
    expect((await request(app).post('/api/payroll/generate').set(auth(token)).send({ month: '2026-08' })).status).toBe(403);
    expect((await request(app).put(`/api/payroll/salary/${ctx.report._id}`).set(auth(token)).send({ basic: 1e9, hra: 0, allowances: 0, deductions: 0 })).status).toBe(403);
  });

  it('an employee cannot see a colleague\'s personal fields, but HR can', async () => {
    const ctx = await seed();
    await Employee.updateOne({ _id: ctx.outsider._id }, { phone: '555-0199', dob: new Date('1990-01-01'), 'address.line1': 'Secret Lane' });
    const asColleague = await request(app).get(`/api/employees/${ctx.outsider._id}`).set(auth(await login('rita@test.com')));
    expect(asColleague.status).toBe(200);
    expect(asColleague.body.data.phone).toBeUndefined();
    expect(asColleague.body.data.dob).toBeUndefined();
    expect(asColleague.body.data.address).toBeUndefined();
    const asHR = await request(app).get(`/api/employees/${ctx.outsider._id}`).set(auth(await login('hr@test.com')));
    expect(asHR.body.data.phone).toBe('555-0199');
  });
});

describe('Mass assignment', () => {
  it('ignores protected fields on employee update (employeeId, status, user, exit/joining tampering)', async () => {
    const ctx = await seed();
    const hrToken = await login('hr@test.com');
    const res = await request(app)
      .put(`/api/employees/${ctx.report._id}`)
      .set(auth(hrToken))
      .send({
        firstName: 'Rita', lastName: 'X', email: 'rita@test.com', joiningDate: '2025-01-01',
        department: ctx.dept._id.toString(), designation: ctx.designation._id.toString(),
        employeeId: 'EMP9999', status: 'inactive', user: ctx.manager.user.toString(), _id: ctx.outsider._id.toString(),
      });
    expect(res.status).toBe(200);
    const stored = await Employee.findById(ctx.report._id).lean();
    expect(stored.employeeId).toBe('EMP0002');
    expect(stored.status).toBe('active');
    expect(stored.user.toString()).not.toBe(ctx.manager.user.toString());
  });

  it('ignores unknown fields on salary and organization updates', async () => {
    const ctx = await seed();
    const hrToken = await login('hr@test.com');
    const salary = await request(app)
      .put(`/api/payroll/salary/${ctx.report._id}`)
      .set(auth(hrToken))
      .send({ basic: 1000, hra: 0, allowances: 0, deductions: 0, employee: ctx.outsider._id.toString(), netSalary: 999999 });
    expect(salary.status).toBe(200);
    expect(salary.body.data.employee).toBe(ctx.report._id.toString());
    expect(salary.body.data.netSalary).toBeUndefined();

    const org = await request(app).put('/api/organization').set(auth(hrToken)).send({ name: 'Acme', _id: '000000000000000000000000', logoUrl: 'javascript:alert(1)' });
    expect(org.status).toBe(200);
    expect(org.body.data.logoUrl).toBe('');
  });

  it('cannot self-elevate the role through the profile endpoint', async () => {
    await seed();
    const token = await login('rita@test.com');
    const res = await request(app).put('/api/profile/me').set(auth(token)).send({ phone: '1', role: 'SUPER_ADMIN', user: { role: 'SUPER_ADMIN' } });
    expect(res.status).toBe(200);
    const user = await User.findOne({ email: 'rita@test.com' }).lean();
    expect(user.role).toBe('EMPLOYEE');
  });
});

describe('Input hardening', () => {
  it('rejects malformed ObjectIds with 422 on every id route, not a 500', async () => {
    await seed();
    const token = await login('hr@test.com');
    for (const path of ['/api/employees/abc', '/api/departments/abc', '/api/designations/abc', '/api/payroll/abc', '/api/payroll/salary/abc']) {
      const res = await request(app).get(path).set(auth(token));
      expect([422, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    }
    expect((await request(app).patch('/api/leaves/abc/approve').set(auth(token)).send({})).status).toBe(422);
  });

  it('rejects query-operator injection and out-of-range pagination', async () => {
    await seed();
    const token = await login('hr@test.com');
    expect((await request(app).get('/api/employees?status[$ne]=active').set(auth(token))).status).toBe(422);
    expect((await request(app).get('/api/employees?limit=100000').set(auth(token))).status).toBe(422);
    expect((await request(app).get('/api/employees?sort=passwordHash').set(auth(token))).status).toBe(422);
  });

  it('search terms with regex metacharacters are treated literally', async () => {
    await seed();
    const token = await login('hr@test.com');
    const res = await request(app).get('/api/employees?search=.*').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    const evil = await request(app).get('/api/employees/search?q=(a%2B)%2B$').set(auth(token));
    expect(evil.status).toBe(200);
  });

  it('rejects oversized JSON bodies with 413 and malformed JSON with 400', async () => {
    await seed();
    const token = await login('hr@test.com');
    const big = await request(app)
      .put('/api/organization')
      .set(auth(token))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'Acme', address: 'x'.repeat(150 * 1024) }));
    expect(big.status).toBe(413);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(bad.status).toBe(400);
    expect(bad.body.success).toBe(false);
  });

  it('enforces field length limits', async () => {
    await seed();
    const token = await login('rita@test.com');
    const res = await request(app).post('/api/leaves/apply').set(auth(token)).send({ leaveType: '000000000000000000000000', startDate: '2026-08-03', endDate: '2026-08-03', reason: 'x'.repeat(501) });
    expect(res.status).toBe(422);
  });
});

describe('Sensitive information leakage', () => {
  it('never returns password hashes, reset tokens or token versions', async () => {
    const ctx = await seed();
    const hrToken = await login('hr@test.com');
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'rita@test.com', password: PASSWORD });
    const text = JSON.stringify(loginRes.body);
    expect(text).not.toMatch(/passwordHash|passwordResetToken|tokenVersion|\$2b\$/);
    const me = await request(app).get('/api/auth/me').set(auth(loginRes.body.data.accessToken));
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|\$2b\$/);
    const emp = await request(app).get(`/api/employees/${ctx.report._id}`).set(auth(hrToken));
    expect(JSON.stringify(emp.body)).not.toMatch(/passwordHash|\$2b\$/);
    const sessions = await request(app).get('/api/auth/sessions').set(auth(hrToken));
    expect(JSON.stringify(sessions.body)).not.toMatch(/tokenHash/);
  });

  it('unknown routes and unexpected errors do not expose stack traces', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:\d+/);
  });

  it('login does not reveal whether an email exists', async () => {
    await seed();
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: PASSWORD });
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'rita@test.com', password: 'Nope@1234' });
    expect(unknown.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPassword.body.message);
  });
});
