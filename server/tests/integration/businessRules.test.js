const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Employee, Department, Designation, LeaveType, Attendance, Payroll, Salary } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');
const { startOfDay } = require('../../src/utils/dateHelpers');

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

async function seedOrg() {
  const passwordHash = await hashPassword(PASSWORD);
  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });
  const leaveType = await LeaveType.create({ name: 'Casual Leave', defaultDaysPerYear: 5 });

  const hr = await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  const manager = await Employee.create({
    employeeId: 'EMP0001', firstName: 'Mia', lastName: 'Manager', email: 'manager@test.com',
    joiningDate: new Date('2025-01-01T00:00:00Z'), department: dept._id, designation: designation._id,
  });
  const managerUser = await User.create({ email: 'manager@test.com', passwordHash, role: 'MANAGER', employee: manager._id });
  manager.user = managerUser._id;
  await manager.save();

  const employee = await Employee.create({
    employeeId: 'EMP0002', firstName: 'Eve', lastName: 'Employee', email: 'employee@test.com', phone: '555-0100',
    dob: new Date('1990-01-01'), address: { line1: '1 Private Lane', city: 'Secret' },
    joiningDate: new Date('2025-01-01T00:00:00Z'), department: dept._id, designation: designation._id, manager: manager._id,
  });
  const employeeUser = await User.create({ email: 'employee@test.com', passwordHash, role: 'EMPLOYEE', employee: employee._id });
  employee.user = employeeUser._id;
  await employee.save();

  const colleague = await Employee.create({
    employeeId: 'EMP0003', firstName: 'Carl', lastName: 'Colleague', email: 'colleague@test.com',
    joiningDate: new Date('2025-01-01T00:00:00Z'), department: dept._id, designation: designation._id,
  });
  const colleagueUser = await User.create({ email: 'colleague@test.com', passwordHash, role: 'EMPLOYEE', employee: colleague._id });
  colleague.user = colleagueUser._id;
  await colleague.save();

  return { dept, designation, leaveType, hr, manager, employee, colleague };
}

describe('Leave business rules', () => {
  let ctx;
  let employeeToken;

  beforeEach(async () => {
    ctx = await seedOrg();
    employeeToken = await login('employee@test.com');
  });

  const apply = (body) =>
    request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ leaveType: ctx.leaveType._id.toString(), reason: 'Trip', ...body });

  it('rejects a request that overlaps a pending one', async () => {
    const first = await apply({ startDate: '2026-08-10', endDate: '2026-08-12' });
    expect(first.status).toBe(201);

    const overlapping = await apply({ startDate: '2026-08-12', endDate: '2026-08-14' });
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.code).toBe('LEAVE_OVERLAP');

    const adjacent = await apply({ startDate: '2026-08-13', endDate: '2026-08-13' });
    expect(adjacent.status).toBe(201);
  });

  it('allows re-applying for dates that were previously cancelled', async () => {
    const first = await apply({ startDate: '2026-08-10', endDate: '2026-08-10' });
    await request(app).patch(`/api/leaves/${first.body.data._id}/cancel`).set('Authorization', `Bearer ${employeeToken}`);

    const again = await apply({ startDate: '2026-08-10', endDate: '2026-08-10' });
    expect(again.status).toBe(201);
  });

  it('rejects a request that exceeds the remaining annual balance (pending days count)', async () => {
    const year = new Date().getUTCFullYear();
    const first = await apply({ startDate: `${year}-03-02`, endDate: `${year}-03-04` }); // 3 of 5
    expect(first.status).toBe(201);

    const tooMany = await apply({ startDate: `${year}-04-06`, endDate: `${year}-04-08` }); // needs 3, only 2 left
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.code).toBe('LEAVE_BALANCE_EXCEEDED');

    const fits = await apply({ startDate: `${year}-04-06`, endDate: `${year}-04-07` }); // exactly 2
    expect(fits.status).toBe(201);
  });

  it('reports balance including pending reservations', async () => {
    const year = new Date().getUTCFullYear();
    await apply({ startDate: `${year}-03-02`, endDate: `${year}-03-03` });
    const res = await request(app).get('/api/leaves/me/balance').set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ allocated: 5, used: 0, pending: 2, remaining: 3 });
  });

  it('does not let a manager approve their own request and returns 409 on a second decision', async () => {
    const managerToken = await login('manager@test.com');
    const own = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ leaveType: ctx.leaveType._id.toString(), startDate: '2026-08-20', endDate: '2026-08-20', reason: 'Own' });
    expect(own.status).toBe(201);

    const selfApprove = await request(app)
      .patch(`/api/leaves/${own.body.data._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(selfApprove.status).toBe(403);

    const hrToken = await login('hr@test.com');
    const approve = await request(app).patch(`/api/leaves/${own.body.data._id}/approve`).set('Authorization', `Bearer ${hrToken}`).send({});
    expect(approve.status).toBe(200);
    const reject = await request(app).patch(`/api/leaves/${own.body.data._id}/reject`).set('Authorization', `Bearer ${hrToken}`).send({});
    expect(reject.status).toBe(409);
  });

  it('marks attendance on UTC-midnight day keys for every approved day', async () => {
    const res = await apply({ startDate: '2026-08-10', endDate: '2026-08-11' });
    const managerToken = await login('manager@test.com');
    await request(app).patch(`/api/leaves/${res.body.data._id}/approve`).set('Authorization', `Bearer ${managerToken}`).send({});

    const records = await Attendance.find({ employee: ctx.employee._id, status: 'Leave' }).sort({ date: 1 });
    expect(records.map((r) => r.date.toISOString())).toEqual(['2026-08-10T00:00:00.000Z', '2026-08-11T00:00:00.000Z']);
  });
});

describe('Attendance atomicity', () => {
  let ctx;
  let token;

  beforeEach(async () => {
    ctx = await seedOrg();
    token = await login('employee@test.com');
  });

  it('two concurrent check-ins produce exactly one record and one clean 409', async () => {
    const [a, b] = await Promise.all([
      request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${token}`),
      request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${token}`),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = a.status === 409 ? a : b;
    expect(failed.body.message).toMatch(/already checked in/i);
    expect(await Attendance.countDocuments({ employee: ctx.employee._id })).toBe(1);
  });

  it('stores today under the business-timezone day key and check-out is single-use', async () => {
    await request(app).post('/api/attendance/check-in').set('Authorization', `Bearer ${token}`);
    const record = await Attendance.findOne({ employee: ctx.employee._id });
    expect(record.date.toISOString()).toBe(startOfDay().toISOString());

    const first = await request(app).post('/api/attendance/check-out').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/attendance/check-out').set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(409);
  });

  it('rejects operator injection in list filters with 422', async () => {
    const hrToken = await login('hr@test.com');
    const res = await request(app).get('/api/attendance?employee[$ne]=x').set('Authorization', `Bearer ${hrToken}`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('Payroll state machine', () => {
  let ctx;
  let hrToken;

  beforeEach(async () => {
    ctx = await seedOrg();
    hrToken = await login('hr@test.com');
    await Salary.create({ employee: ctx.employee._id, basic: 1000, hra: 100, allowances: 10.55, deductions: 0.05 });
  });

  it('never moves backwards or skips a step', async () => {
    const gen = await request(app)
      .post('/api/payroll/generate')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ month: '2026-07', employeeId: ctx.employee._id.toString() });
    expect(gen.status).toBe(201);
    const [payroll] = gen.body.data.generated;
    expect(payroll.grossSalary).toBe(1110.55);
    expect(payroll.netSalary).toBe(1110.5);

    const skip = await request(app).patch(`/api/payroll/${payroll._id}/status`).set('Authorization', `Bearer ${hrToken}`).send({ status: 'Paid' });
    expect(skip.status).toBe(409);
    expect(skip.body.code).toBe('INVALID_TRANSITION');

    const processed = await request(app).patch(`/api/payroll/${payroll._id}/status`).set('Authorization', `Bearer ${hrToken}`).send({ status: 'Processed' });
    expect(processed.status).toBe(200);

    const back = await request(app).patch(`/api/payroll/${payroll._id}/status`).set('Authorization', `Bearer ${hrToken}`).send({ status: 'Draft' });
    expect(back.status).toBe(409);

    const paid = await request(app).patch(`/api/payroll/${payroll._id}/status`).set('Authorization', `Bearer ${hrToken}`).send({ status: 'Paid' });
    expect(paid.status).toBe(200);
    expect((await Payroll.findById(payroll._id)).status).toBe('Paid');
  });

  it('lists salary structures with gross/net and flags employees without one', async () => {
    const res = await request(app).get('/api/payroll/salaries').set('Authorization', `Bearer ${hrToken}`);
    expect(res.status).toBe(200);
    const withSalary = res.body.data.find((r) => r.employee.employeeId === 'EMP0002');
    const without = res.body.data.find((r) => r.employee.employeeId === 'EMP0003');
    expect(withSalary.netSalary).toBe(1110.5);
    expect(without.salary).toBeNull();
    expect(res.body.pagination).toMatchObject({ page: 1, total: 3 });
    expect(res.body.meta.missing).toBe(2);

    const missingOnly = await request(app).get('/api/payroll/salaries?missing=true&search=EMP000').set('Authorization', `Bearer ${hrToken}`);
    expect(missingOnly.body.data.map((r) => r.employee.employeeId).sort()).toEqual(['EMP0001', 'EMP0003']);
    const paged = await request(app).get('/api/payroll/salaries?limit=1&page=2').set('Authorization', `Bearer ${hrToken}`);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.pagination.pages).toBe(3);
  });
});

describe('Employee data scoping', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await seedOrg();
  });

  it('hides personal fields from colleagues but not from HR, the manager, or the employee themselves', async () => {
    const colleagueToken = await login('colleague@test.com');
    const asColleague = await request(app).get(`/api/employees/${ctx.employee._id}`).set('Authorization', `Bearer ${colleagueToken}`);
    expect(asColleague.status).toBe(200);
    expect(asColleague.body.data.firstName).toBe('Eve');
    expect(asColleague.body.data.phone).toBeUndefined();
    expect(asColleague.body.data.dob).toBeUndefined();
    expect(asColleague.body.data.address).toBeUndefined();

    const list = await request(app).get('/api/employees').set('Authorization', `Bearer ${colleagueToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.every((e) => e.address === undefined && e.dob === undefined)).toBe(true);

    const selfToken = await login('employee@test.com');
    const asSelf = await request(app).get(`/api/employees/${ctx.employee._id}`).set('Authorization', `Bearer ${selfToken}`);
    expect(asSelf.body.data.phone).toBe('555-0100');

    const managerToken = await login('manager@test.com');
    const asManager = await request(app).get(`/api/employees/${ctx.employee._id}`).set('Authorization', `Bearer ${managerToken}`);
    expect(asManager.body.data.address.city).toBe('Secret');

    const hrToken = await login('hr@test.com');
    const asHR = await request(app).get(`/api/employees/${ctx.employee._id}`).set('Authorization', `Bearer ${hrToken}`);
    expect(asHR.body.data.address.city).toBe('Secret');
  });

  it('generates collision-free ids under concurrent creation and rejects a self-manager', async () => {
    const hrToken = await login('hr@test.com');
    const payload = (i) => ({
      firstName: `New${i}`, lastName: 'Hire', email: `new${i}@test.com`, joiningDate: '2026-09-01',
      department: ctx.dept._id.toString(), designation: ctx.designation._id.toString(),
    });
    const results = await Promise.all([1, 2, 3, 4].map((i) => request(app).post('/api/employees').set('Authorization', `Bearer ${hrToken}`).send(payload(i))));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    const ids = results.map((r) => r.body.data.employeeId);
    expect(new Set(ids).size).toBe(4);
    // Seeded from the existing max (EMP0003), so the first new id is EMP0004.
    expect(ids.sort()).toEqual(['EMP0004', 'EMP0005', 'EMP0006', 'EMP0007']);

    const self = await request(app)
      .put(`/api/employees/${ctx.employee._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ ...payload(9), email: 'employee@test.com', manager: ctx.employee._id.toString() });
    expect(self.status).toBe(422);
  });

  it('returns lightweight options scoped to the manager team', async () => {
    const managerToken = await login('manager@test.com');
    const res = await request(app).get('/api/employees/options').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e.employeeId)).toEqual(['EMP0002']);
    expect(res.body.data[0].email).toBeUndefined();
  });
});

describe('Login lockout and error envelope', () => {
  beforeEach(async () => {
    await seedOrg();
  });

  it('locks the account after repeated failures and unlocks on the configured window', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: 'employee@test.com', password: 'wrong-pass' });
      expect(res.status).toBe(401);
    }
    const locked = await request(app).post('/api/auth/login').send({ email: 'employee@test.com', password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');

    await User.updateOne({ email: 'employee@test.com' }, { lockUntil: new Date(Date.now() - 1000) });
    const ok = await request(app).post('/api/auth/login').send({ email: 'employee@test.com', password: PASSWORD });
    expect(ok.status).toBe(200);
  });

  it('reports malformed JSON as 400 with a stable code, not 500', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('rejects an invalid route id with 422 instead of a CastError', async () => {
    const hrToken = await login('hr@test.com');
    const res = await request(app).get('/api/employees/not-an-id').set('Authorization', `Bearer ${hrToken}`);
    expect(res.status).toBe(422);
  });
});
