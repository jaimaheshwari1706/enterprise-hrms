const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Employee, Department, Designation, LeaveType, LeaveRequest, Attendance, Organization, Salary, Payroll } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');
const { invalidateWorkingCalendar } = require('../../src/services/calendarService');

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

afterEach(async () => {
  await clearTestDB();
  invalidateWorkingCalendar();
});

const PASSWORD = 'Admin@123';

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.data.accessToken;
}

async function seed({ workingDays, holidays = [], payrollPolicy } = {}) {
  const passwordHash = await hashPassword(PASSWORD);
  await Organization.create({
    name: 'Acme',
    ...(workingDays ? { workingDays } : {}),
    holidays: holidays.map((h) => ({ date: new Date(`${h.date}T00:00:00Z`), name: h.name })),
    ...(payrollPolicy ? { payrollPolicy } : {}),
  });
  invalidateWorkingCalendar();

  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });
  const paidType = await LeaveType.create({ name: 'Casual Leave', defaultDaysPerYear: 12, isPaid: true });
  const unpaidType = await LeaveType.create({ name: 'Loss of Pay', defaultDaysPerYear: 30, isPaid: false });

  await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  const employee = await Employee.create({
    employeeId: 'EMP0001', firstName: 'Eve', lastName: 'Employee', email: 'employee@test.com',
    joiningDate: new Date('2025-01-01T00:00:00Z'), department: dept._id, designation: designation._id,
  });
  const employeeUser = await User.create({ email: 'employee@test.com', passwordHash, role: 'EMPLOYEE', employee: employee._id });
  employee.user = employeeUser._id;
  await employee.save();

  const colleague = await Employee.create({
    employeeId: 'EMP0002', firstName: 'Carl', lastName: 'Colleague', email: 'colleague@test.com',
    joiningDate: new Date('2025-01-01T00:00:00Z'), department: dept._id, designation: designation._id,
  });
  const colleagueUser = await User.create({ email: 'colleague@test.com', passwordHash, role: 'EMPLOYEE', employee: colleague._id });
  colleague.user = colleagueUser._id;
  await colleague.save();

  return { dept, designation, paidType, unpaidType, employee, colleague };
}

const apply = (token, body) => request(app).post('/api/leaves/apply').set('Authorization', `Bearer ${token}`).send({ reason: 'Trip', ...body });

describe('Leave counting uses the organization working calendar', () => {
  it('charges only working days for a range spanning a weekend', async () => {
    const ctx = await seed();
    const token = await login('employee@test.com');
    // Fri 7 Aug 2026 → Mon 10 Aug: Fri + Mon = 2 working days
    const res = await apply(token, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-07', endDate: '2026-08-10' });
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(2);
  });

  it('does not charge configured holidays', async () => {
    const ctx = await seed({ holidays: [{ date: '2026-08-12', name: 'Founders Day' }] }); // Wednesday
    const token = await login('employee@test.com');
    const res = await apply(token, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-10', endDate: '2026-08-14' });
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(4); // Mon–Fri minus Wednesday holiday
  });

  it('rejects a request that contains no working days', async () => {
    const ctx = await seed();
    const token = await login('employee@test.com');
    const res = await apply(token, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-08', endDate: '2026-08-09' }); // Sat–Sun
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LEAVE_NO_WORKING_DAYS');
  });

  it('respects a custom working week (Sunday–Thursday)', async () => {
    const ctx = await seed({ workingDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] });
    const token = await login('employee@test.com');
    // Thu 6 Aug → Sun 9 Aug: Thu + Sun = 2 (Fri/Sat are the weekend)
    const res = await apply(token, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-06', endDate: '2026-08-09' });
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(2);
  });

  it('balance is charged in working days, so a week off costs 5 not 7', async () => {
    const ctx = await seed();
    await LeaveType.updateOne({ _id: ctx.paidType._id }, { defaultDaysPerYear: 5 });
    const token = await login('employee@test.com');
    // Mon 3 Aug → Sun 9 Aug = 5 working days: exactly the allowance
    const res = await apply(token, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-03', endDate: '2026-08-09' });
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(5);
  });

  it('previews the day count the server will charge', async () => {
    await seed({ holidays: [{ date: '2026-08-12', name: 'Founders Day' }] });
    const token = await login('employee@test.com');
    const res = await request(app)
      .get('/api/leaves/preview?startDate=2026-08-07&endDate=2026-08-12')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ days: 3, calendarDays: 6, weekendDays: 2, holidayDays: 1, holidays: ['Founders Day'] });
  });

  it('marks only working days as Leave in attendance on approval', async () => {
    const ctx = await seed({ holidays: [{ date: '2026-08-12', name: 'Founders Day' }] });
    const employeeToken = await login('employee@test.com');
    const hrToken = await login('hr@test.com');
    const applied = await apply(employeeToken, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-07', endDate: '2026-08-12' });
    const approved = await request(app).patch(`/api/leaves/${applied.body.data._id}/approve`).set('Authorization', `Bearer ${hrToken}`).send({});
    expect(approved.status).toBe(200);

    const records = await Attendance.find({ employee: ctx.employee._id, status: 'Leave' }).sort({ date: 1 }).lean();
    expect(records.map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2026-08-07', '2026-08-10', '2026-08-11']);
  });

  it('applies holiday changes made through the organization API', async () => {
    const ctx = await seed();
    const hrToken = await login('hr@test.com');
    const update = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ name: 'Acme', holidays: [{ date: '2026-08-11', name: 'Local Holiday' }] });
    expect(update.status).toBe(200);
    expect(update.body.data.holidays).toHaveLength(1);

    const token = await login('employee@test.com');
    const res = await apply(token, { leaveType: ctx.paidType._id.toString(), startDate: '2026-08-10', endDate: '2026-08-11' });
    expect(res.body.data.days).toBe(1);
  });

  it('rejects duplicate holiday dates and an empty working week', async () => {
    await seed();
    const hrToken = await login('hr@test.com');
    const dup = await request(app)
      .put('/api/organization')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ name: 'Acme', holidays: [{ date: '2026-08-11', name: 'A' }, { date: '2026-08-11', name: 'B' }] });
    expect(dup.status).toBe(422);
    const empty = await request(app).put('/api/organization').set('Authorization', `Bearer ${hrToken}`).send({ name: 'Acme', workingDays: [] });
    expect(empty.status).toBe(422);
  });
});

describe('Leave types', () => {
  it('only HR can create or update leave types', async () => {
    await seed();
    const employeeToken = await login('employee@test.com');
    const hrToken = await login('hr@test.com');
    const denied = await request(app).post('/api/leaves/leave-types').set('Authorization', `Bearer ${employeeToken}`).send({ name: 'X', defaultDaysPerYear: 1 });
    expect(denied.status).toBe(403);

    const createdRes = await request(app)
      .post('/api/leaves/leave-types')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ name: 'Sabbatical', defaultDaysPerYear: 10, isPaid: false });
    expect(createdRes.status).toBe(201);
    expect(createdRes.body.data.isPaid).toBe(false);

    const updated = await request(app)
      .put(`/api/leaves/leave-types/${createdRes.body.data._id}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ defaultDaysPerYear: 12 });
    expect(updated.body.data.defaultDaysPerYear).toBe(12);

    const clash = await request(app).post('/api/leaves/leave-types').set('Authorization', `Bearer ${hrToken}`).send({ name: 'Sabbatical', defaultDaysPerYear: 1 });
    expect(clash.status).toBe(409);
  });
});

describe('Payroll generation with pro-rata policy', () => {
  const salary = { basic: 31000, hra: 3100, allowances: 310, deductions: 620 };

  it('pays the fixed structure when the policy is "none" (default)', async () => {
    const ctx = await seed();
    await Salary.create({ employee: ctx.employee._id, ...salary });
    await Employee.updateOne({ _id: ctx.employee._id }, { joiningDate: new Date('2026-08-20T00:00:00Z') });
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08', employeeId: ctx.employee._id.toString() });
    expect(res.status).toBe(201);
    const [payroll] = res.body.data.generated;
    expect(payroll.netSalary).toBe(33790);
    expect(payroll.period).toMatchObject({ basis: 'none', factor: 1, employedDays: 12 });
    expect(payroll.payslipNumber).toMatch(/^PS-202608-\d{4}$/);
  });

  it('pro-rates a mid-month joiner on calendar days', async () => {
    const ctx = await seed({ payrollPolicy: { proRataBasis: 'calendar', deductUnpaidLeave: false } });
    await Salary.create({ employee: ctx.employee._id, ...salary });
    await Employee.updateOne({ _id: ctx.employee._id }, { joiningDate: new Date('2026-08-22T00:00:00Z') }); // 10 of 31 days
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08', employeeId: ctx.employee._id.toString() });
    const [payroll] = res.body.data.generated;
    expect(payroll.period).toMatchObject({ basis: 'calendar', totalDays: 31, employedDays: 10, payableDays: 10 });
    expect(payroll.basic).toBe(10000);
    expect(payroll.hra).toBe(1000);
    expect(payroll.allowances).toBe(100);
    expect(payroll.deductions).toBe(200);
    expect(payroll.grossSalary).toBe(11100);
    expect(payroll.netSalary).toBe(10900);
  });

  it('pro-rates a leaver (inactive with exitDate in the month) and skips later months', async () => {
    const ctx = await seed({ payrollPolicy: { proRataBasis: 'calendar', deductUnpaidLeave: false } });
    await Salary.create({ employee: ctx.employee._id, ...salary });
    const hrToken = await login('hr@test.com');

    const deactivate = await request(app)
      .patch(`/api/employees/${ctx.employee._id}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'inactive', exitDate: '2026-07-10' });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.exitDate).toBe('2026-07-10T00:00:00.000Z');

    const july = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-07', employeeId: ctx.employee._id.toString() });
    expect(july.status).toBe(201);
    expect(july.body.data.generated[0].period).toMatchObject({ employedDays: 10, totalDays: 31 });
    expect(july.body.data.generated[0].basic).toBe(10000);

    const august = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08', employeeId: ctx.employee._id.toString() });
    expect(august.status).toBe(404); // not eligible at all
  });

  it('skips an employee who joined after the month', async () => {
    const ctx = await seed();
    await Salary.create({ employee: ctx.employee._id, ...salary });
    await Employee.updateOne({ _id: ctx.employee._id }, { joiningDate: new Date('2026-09-01T00:00:00Z') });
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08', employeeId: ctx.employee._id.toString() });
    expect(res.body.data.generated).toHaveLength(0);
    expect(res.body.data.skipped[0].reason).toMatch(/joined after/i);
  });

  it('deducts approved unpaid leave (working days) when the policy says so', async () => {
    const ctx = await seed({ payrollPolicy: { proRataBasis: 'working', deductUnpaidLeave: true } });
    await Salary.create({ employee: ctx.employee._id, basic: 21000, hra: 0, allowances: 0, deductions: 0 });
    // Approved unpaid leave Fri 7 → Mon 10 Aug = 2 working days; Aug 2026 has 21 working days.
    await LeaveRequest.create({
      employee: ctx.employee._id, leaveType: ctx.unpaidType._id, startDate: new Date('2026-08-07T00:00:00Z'), endDate: new Date('2026-08-10T00:00:00Z'),
      days: 2, reason: 'Unpaid', status: 'Approved',
    });
    // A paid leave in the same month must not affect pay.
    await LeaveRequest.create({
      employee: ctx.employee._id, leaveType: ctx.paidType._id, startDate: new Date('2026-08-17T00:00:00Z'), endDate: new Date('2026-08-18T00:00:00Z'),
      days: 2, reason: 'Paid', status: 'Approved',
    });
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08', employeeId: ctx.employee._id.toString() });
    const [payroll] = res.body.data.generated;
    expect(payroll.period).toMatchObject({ basis: 'working', totalDays: 21, employedDays: 21, unpaidLeaveDays: 2, payableDays: 19 });
    expect(payroll.basic).toBe(19000);
    expect(payroll.netSalary).toBe(19000);
  });

  it('refuses to generate payroll for a future month', async () => {
    const ctx = await seed();
    await Salary.create({ employee: ctx.employee._id, ...salary });
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2099-01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAYROLL_FUTURE_MONTH');
  });

  it('assigns unique payslip numbers across runs', async () => {
    const ctx = await seed();
    await Salary.create({ employee: ctx.employee._id, ...salary });
    await Salary.create({ employee: ctx.colleague._id, ...salary });
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08' });
    const numbers = res.body.data.generated.map((p) => p.payslipNumber).sort();
    expect(numbers).toEqual(['PS-202608-0001', 'PS-202608-0002']);
  });
});

describe('Payslip access', () => {
  async function generateFor(ctx) {
    await Salary.create({ employee: ctx.employee._id, basic: 1000, hra: 0, allowances: 0, deductions: 0 });
    const hrToken = await login('hr@test.com');
    const res = await request(app).post('/api/payroll/generate').set('Authorization', `Bearer ${hrToken}`).send({ month: '2026-08', employeeId: ctx.employee._id.toString() });
    return { hrToken, payroll: res.body.data.generated[0] };
  }

  it('hides a Draft payslip from the employee but shows it to HR', async () => {
    const ctx = await seed();
    const { hrToken, payroll } = await generateFor(ctx);
    const employeeToken = await login('employee@test.com');

    const asEmployee = await request(app).get(`/api/payroll/${payroll._id}`).set('Authorization', `Bearer ${employeeToken}`);
    expect(asEmployee.status).toBe(404);

    const asHR = await request(app).get(`/api/payroll/${payroll._id}`).set('Authorization', `Bearer ${hrToken}`);
    expect(asHR.status).toBe(200);
    expect(asHR.body.data.employee.employeeId).toBe('EMP0001');
    expect(asHR.body.data.organization.name).toBe('Acme');
  });

  it('shows a processed payslip to its owner only', async () => {
    const ctx = await seed();
    const { payroll } = await generateFor(ctx);
    await Payroll.updateOne({ _id: payroll._id }, { status: 'Processed' });

    const owner = await request(app).get(`/api/payroll/${payroll._id}`).set('Authorization', `Bearer ${await login('employee@test.com')}`);
    expect(owner.status).toBe(200);
    expect(owner.body.data.netSalary).toBe(1000);
    expect(owner.body.data.period).toBeDefined();

    const colleague = await request(app).get(`/api/payroll/${payroll._id}`).set('Authorization', `Bearer ${await login('colleague@test.com')}`);
    expect(colleague.status).toBe(404); // indistinguishable from "does not exist"
  });

  it('rejects a malformed payroll id', async () => {
    await seed();
    const res = await request(app).get('/api/payroll/not-an-id').set('Authorization', `Bearer ${await login('employee@test.com')}`);
    expect(res.status).toBe(422);
  });
});
