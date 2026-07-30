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

async function loginAs(email, password = 'Admin@123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.accessToken;
}

async function seedRoleUsers() {
  const passwordHash = await hashPassword('Admin@123');
  await User.create({ email: 'superadmin@test.com', passwordHash, role: 'SUPER_ADMIN' });
  await User.create({ email: 'hr@test.com', passwordHash, role: 'HR_ADMIN' });

  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });

  const managerEmployee = await Employee.create({
    employeeId: 'EMP0001',
    firstName: 'Manager',
    lastName: 'One',
    email: 'manager@test.com',
    joiningDate: new Date(),
    department: dept._id,
    designation: designation._id,
  });
  const managerUser = await User.create({
    email: 'manager@test.com', passwordHash, role: 'MANAGER', employee: managerEmployee._id,
  });
  managerEmployee.user = managerUser._id;
  await managerEmployee.save();

  const employee = await Employee.create({
    employeeId: 'EMP0002',
    firstName: 'Regular',
    lastName: 'Employee',
    email: 'employee@test.com',
    joiningDate: new Date(),
    department: dept._id,
    designation: designation._id,
    manager: managerEmployee._id,
  });
  const employeeUser = await User.create({
    email: 'employee@test.com', passwordHash, role: 'EMPLOYEE', employee: employee._id,
  });
  employee.user = employeeUser._id;
  await employee.save();

  return { dept, designation, managerEmployee, employee };
}

describe('RBAC / Authorization', () => {
  it('blocks an EMPLOYEE from creating a department (HR_ADMIN/SUPER_ADMIN only)', async () => {
    await seedRoleUsers();
    const token = await loginAs('employee@test.com');

    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Finance', code: 'FIN' });

    expect(res.status).toBe(403);
  });

  it('allows an HR_ADMIN to create a department', async () => {
    await seedRoleUsers();
    const token = await loginAs('hr@test.com');

    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Finance', code: 'FIN' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Finance');
  });

  it('blocks a MANAGER from viewing another team\'s attendance via an explicit employee filter', async () => {
    const { employee } = await seedRoleUsers();

    // A second manager+report pair, unrelated to the first.
    const passwordHash = await hashPassword('Admin@123');
    const dept2 = await Department.create({ name: 'Sales', code: 'SALES' });
    const designation2 = await Designation.create({ name: 'Sales Rep', code: 'SL1', department: dept2._id });
    const otherManagerEmployee = await Employee.create({
      employeeId: 'EMP0099', firstName: 'Other', lastName: 'Manager', email: 'othermanager@test.com',
      joiningDate: new Date(), department: dept2._id, designation: designation2._id,
    });
    const otherManagerUser = await User.create({
      email: 'othermanager@test.com', passwordHash, role: 'MANAGER', employee: otherManagerEmployee._id,
    });
    otherManagerEmployee.user = otherManagerUser._id;
    await otherManagerEmployee.save();

    const token = await loginAs('othermanager@test.com');

    // Try to query the OTHER manager's report's attendance directly.
    const res = await request(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${token}`)
      .query({ employee: employee._id.toString() });

    expect(res.status).toBe(403);
  });

  it('allows a MANAGER to view their own direct report\'s attendance', async () => {
    const { employee } = await seedRoleUsers();
    const token = await loginAs('manager@test.com');

    const res = await request(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${token}`)
      .query({ employee: employee._id.toString() });

    expect(res.status).toBe(200);
  });

  it('blocks access entirely without a token, regardless of role', async () => {
    await seedRoleUsers();
    const res = await request(app).get('/api/employees');
    expect(res.status).toBe(401);
  });
});
