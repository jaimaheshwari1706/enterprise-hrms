const request = require('supertest');
const app = require('../../src/app');
const { connectTestDB, disconnectTestDB, clearTestDB } = require('../setup');
const { User, Employee, Department, Designation, LeaveType, Attendance, Approval } = require('../../src/models');
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

let managerToken;
let employeeToken;
let employee;
let leaveType;

beforeEach(async () => {
  const passwordHash = await hashPassword('Admin@123');
  const dept = await Department.create({ name: 'Engineering', code: 'ENG' });
  const designation = await Designation.create({ name: 'Engineer', code: 'ENG1', department: dept._id });
  leaveType = await LeaveType.create({ name: 'Casual Leave', defaultDaysPerYear: 12 });

  const managerEmployee = await Employee.create({
    employeeId: 'EMP0001', firstName: 'Manager', lastName: 'One', email: 'manager@test.com',
    joiningDate: new Date(), department: dept._id, designation: designation._id,
  });
  const managerUser = await User.create({ email: 'manager@test.com', passwordHash, role: 'MANAGER', employee: managerEmployee._id });
  managerEmployee.user = managerUser._id;
  await managerEmployee.save();

  employee = await Employee.create({
    employeeId: 'EMP0002', firstName: 'Regular', lastName: 'Employee', email: 'employee@test.com',
    joiningDate: new Date(), department: dept._id, designation: designation._id, manager: managerEmployee._id,
  });
  const employeeUser = await User.create({ email: 'employee@test.com', passwordHash, role: 'EMPLOYEE', employee: employee._id });
  employee.user = employeeUser._id;
  await employee.save();

  managerToken = (await request(app).post('/api/auth/login').send({ email: 'manager@test.com', password: 'Admin@123' })).body.data.accessToken;
  employeeToken = (await request(app).post('/api/auth/login').send({ email: 'employee@test.com', password: 'Admin@123' })).body.data.accessToken;
});

describe('Leave application + approval workflow', () => {
  it('lets an employee apply for leave, creating a Pending request and Approval record', async () => {
    const res = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveType: leaveType._id.toString(),
        startDate: '2026-08-10',
        endDate: '2026-08-12',
        reason: 'Family trip',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('Pending');
    expect(res.body.data.days).toBe(3);

    const approval = await Approval.findOne({ requestId: res.body.data._id });
    expect(approval).not.toBeNull();
    expect(approval.status).toBe('Pending');
    expect(approval.approver.toString()).toBe((await Employee.findOne({ email: 'manager@test.com' }))._id.toString());
  });

  it('lets the direct manager approve the request, and marks Attendance as Leave for those days', async () => {
    const applyRes = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ leaveType: leaveType._id.toString(), startDate: '2026-08-10', endDate: '2026-08-11', reason: 'Trip' });

    const leaveId = applyRes.body.data._id;

    const approveRes = await request(app)
      .patch(`/api/leaves/${leaveId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'Enjoy!' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('Approved');

    const attendanceRecords = await Attendance.find({ employee: employee._id, status: 'Leave' });
    expect(attendanceRecords).toHaveLength(2); // Aug 10 + Aug 11
  });

  it('blocks a random employee (not the manager, not HR) from approving', async () => {
    const passwordHash = await hashPassword('Admin@123');
    await User.create({ email: 'outsider@test.com', passwordHash, role: 'EMPLOYEE' });

    const applyRes = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ leaveType: leaveType._id.toString(), startDate: '2026-08-10', endDate: '2026-08-10', reason: 'Trip' });

    const outsiderLogin = await request(app).post('/api/auth/login').send({ email: 'outsider@test.com', password: 'Admin@123' });

    // Outsider has no HR/Manager role at all, so the route itself should 403.
    const res = await request(app)
      .patch(`/api/leaves/${applyRes.body.data._id}/approve`)
      .set('Authorization', `Bearer ${outsiderLogin.body.data.accessToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('rejects trying to approve an already-approved request', async () => {
    const applyRes = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ leaveType: leaveType._id.toString(), startDate: '2026-08-10', endDate: '2026-08-10', reason: 'Trip' });

    await request(app)
      .patch(`/api/leaves/${applyRes.body.data._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    const secondAttempt = await request(app)
      .patch(`/api/leaves/${applyRes.body.data._id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(secondAttempt.status).toBe(409);
  });

  it('lets an employee cancel their own pending request but not someone else\'s', async () => {
    const applyRes = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ leaveType: leaveType._id.toString(), startDate: '2026-08-10', endDate: '2026-08-10', reason: 'Trip' });

    const cancelRes = await request(app)
      .patch(`/api/leaves/${applyRes.body.data._id}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('Cancelled');

    // The manager cannot cancel someone else's request (only the owner can).
    const applyRes2 = await request(app)
      .post('/api/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ leaveType: leaveType._id.toString(), startDate: '2026-08-17', endDate: '2026-08-17', reason: 'Trip 2' });

    const managerCancelAttempt = await request(app)
      .patch(`/api/leaves/${applyRes2.body.data._id}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(managerCancelAttempt.status).toBe(403);
  });
});
