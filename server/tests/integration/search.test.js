const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Employee, Department, Designation, LeaveType, LeaveRequest, Payroll } = require('../../src/models');
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
const search = (token, q) => request(app).get('/api/search').query({ q }).set('Authorization', `Bearer ${token}`);

async function seed() {
  const passwordHash = await hashPassword(PASSWORD);
  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });
  const type = await LeaveType.create({ name: 'Casual Leave', defaultDaysPerYear: 12 });
  await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  const mk = async (id, first, last, role, extra = {}) => {
    const emp = await Employee.create({ employeeId: id, firstName: first, lastName: last, email: `${first.toLowerCase()}@test.com`, joiningDate: new Date('2025-01-01'), department: dept._id, designation: designation._id, ...extra });
    const user = await User.create({ email: emp.email, passwordHash, role, employee: emp._id });
    emp.user = user._id;
    await emp.save();
    return emp;
  };
  const manager = await mk('EMP0001', 'Mia', 'Manager', 'MANAGER');
  const report = await mk('EMP0002', 'Rita', 'Report', 'EMPLOYEE', { manager: manager._id });
  const outsider = await mk('EMP0003', 'Oscar', 'Outsider', 'EMPLOYEE');

  const leaveFor = (emp) => LeaveRequest.create({ employee: emp._id, leaveType: type._id, startDate: new Date('2026-08-03'), endDate: new Date('2026-08-04'), days: 2, reason: 'x', status: 'Pending' });
  await leaveFor(report);
  await leaveFor(outsider);
  await Payroll.create({ employee: report._id, month: '2026-07', basic: 1, hra: 0, allowances: 0, deductions: 0, grossSalary: 1, netSalary: 1, status: 'Paid' });
  await Payroll.create({ employee: outsider._id, month: '2026-07', basic: 1, hra: 0, allowances: 0, deductions: 0, grossSalary: 1, netSalary: 1, status: 'Paid' });
  await Payroll.create({ employee: outsider._id, month: '2026-08', basic: 1, hra: 0, allowances: 0, deductions: 0, grossSalary: 1, netSalary: 1, status: 'Draft' });
  return { manager, report, outsider };
}

describe('GET /api/search — role scoping', () => {
  it('requires authentication and ignores queries under 2 characters', async () => {
    expect((await request(app).get('/api/search?q=abc')).status).toBe(401);
    await seed();
    const res = await search(await login('hr@test.com'), 'a');
    expect(res.body.data).toEqual({ employees: [], departments: [], leaves: [], payroll: [] });
  });

  it('HR sees every group, including other people\'s leave and payroll', async () => {
    await seed();
    const res = await search(await login('hr@test.com'), 'Oscar');
    expect(res.status).toBe(200);
    expect(res.body.data.employees.map((e) => e.firstName)).toEqual(['Oscar']);
    expect(res.body.data.leaves).toHaveLength(1);
    expect(res.body.data.payroll.map((p) => p.month).sort()).toEqual(['2026-07', '2026-08']);
    const months = await search(await login('hr@test.com'), '2026-08');
    expect(months.body.data.payroll).toHaveLength(1);
  });

  it('a MANAGER only sees their own team\'s employees and leave, and never payroll amounts of others', async () => {
    await seed();
    const token = await login('mia@test.com');
    const own = await search(token, 'Rita');
    expect(own.body.data.employees.map((e) => e.firstName)).toEqual(['Rita']);
    expect(own.body.data.leaves).toHaveLength(1);
    expect(own.body.data.payroll).toHaveLength(0);

    const other = await search(token, 'Oscar');
    expect(other.body.data.employees).toHaveLength(0);
    expect(other.body.data.leaves).toHaveLength(0);
    expect(other.body.data.payroll).toHaveLength(0);

    // Status word search stays inside the team.
    const pending = await search(token, 'pending');
    expect(pending.body.data.leaves.map((l) => l.employee.firstName)).toEqual(['Rita']);
  });

  it('an EMPLOYEE sees the directory but only their own leave and non-Draft payslips', async () => {
    await seed();
    const token = await login('oscar@test.com');
    const byName = await search(token, 'Rita');
    expect(byName.body.data.employees.map((e) => e.firstName)).toEqual(['Rita']); // directory view
    expect(byName.body.data.employees[0].phone).toBeUndefined();
    expect(byName.body.data.leaves).toHaveLength(0);
    expect(byName.body.data.payroll).toHaveLength(0);

    const pending = await search(token, 'pending');
    expect(pending.body.data.leaves).toHaveLength(1);
    expect(pending.body.data.leaves[0].employee.firstName).toBe('Oscar');

    const payslips = await search(token, 'payslip');
    expect(payslips.body.data.payroll.map((p) => p.month)).toEqual(['2026-07']); // Draft Aug hidden
  });

  it('matches departments and designations for everyone', async () => {
    await seed();
    const res = await search(await login('oscar@test.com'), 'eng');
    const kinds = res.body.data.departments.map((d) => d.kind).sort();
    expect(kinds).toEqual(['department', 'designation']);
  });

  it('is safe against regex metacharacters', async () => {
    await seed();
    const res = await search(await login('hr@test.com'), '(a+)+$');
    expect(res.status).toBe(200);
    expect(res.body.data.employees).toHaveLength(0);
  });
});
