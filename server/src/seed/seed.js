// Seeds a complete, realistic demo dataset so the app looks fully alive
// right after setup: 1 Super Admin, 1 HR Admin, 2 Managers, 15 Employees,
// departments/designations, ~2 weeks of attendance history, a mix of leave
// requests, 2 months of payroll, and a few notifications.
//
// This is destructive: it clears existing data in the collections it seeds
// before inserting fresh demo data, so don't run it against a database you
// care about.
//
// Usage: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const { hashPassword } = require('../utils/password');
const {
  User,
  Employee,
  Organization,
  Department,
  Designation,
  Attendance,
  LeaveType,
  LeaveRequest,
  Approval,
  Salary,
  Payroll,
  Notification,
  AuditLog,
  RefreshToken,
} = require('../models');

const DEMO_PASSWORD = 'Demo@1234';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

async function run() {
  await mongoose.connect(env.mongoUri);
  console.log('[seed] Connected to MongoDB. Clearing existing demo collections...');

  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Organization.deleteMany({}),
    Department.deleteMany({}),
    Designation.deleteMany({}),
    Attendance.deleteMany({}),
    LeaveType.deleteMany({}),
    LeaveRequest.deleteMany({}),
    Approval.deleteMany({}),
    Salary.deleteMany({}),
    Payroll.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    RefreshToken.deleteMany({}),
  ]);

  // ---------------------------------------------------------------------
  // Organization
  // ---------------------------------------------------------------------
  const organization = await Organization.create({
    name: 'Nimbus Technologies Pvt. Ltd.',
    email: 'hello@nimbustech.example',
    phone: '+91 22 4000 5000',
    address: '4th Floor, Orion Business Park, Mumbai, India',
    country: 'India',
    timezone: 'Asia/Kolkata',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    officeStartTime: '09:30',
    officeEndTime: '18:30',
  });
  console.log('[seed] Created organization:', organization.name);

  // ---------------------------------------------------------------------
  // Departments
  // ---------------------------------------------------------------------
  const departmentDefs = [
    { name: 'Engineering', code: 'ENG', description: 'Product engineering and platform teams' },
    { name: 'Sales', code: 'SALES', description: 'New business and account management' },
    { name: 'Marketing', code: 'MKT', description: 'Brand, content, and growth marketing' },
    { name: 'Finance', code: 'FIN', description: 'Accounting, payroll, and financial planning' },
    { name: 'Human Resources', code: 'HR', description: 'People operations and talent' },
  ];
  const departments = {};
  for (const def of departmentDefs) {
    departments[def.code] = await Department.create(def);
  }
  console.log('[seed] Created', departmentDefs.length, 'departments');

  // ---------------------------------------------------------------------
  // Designations
  // ---------------------------------------------------------------------
  const designationDefs = [
    { name: 'Software Engineer', code: 'SE', department: 'ENG' },
    { name: 'Senior Software Engineer', code: 'SSE', department: 'ENG' },
    { name: 'Engineering Manager', code: 'EM', department: 'ENG' },
    { name: 'Sales Executive', code: 'SLE', department: 'SALES' },
    { name: 'Sales Manager', code: 'SLM', department: 'SALES' },
    { name: 'Marketing Specialist', code: 'MKS', department: 'MKT' },
    { name: 'Marketing Manager', code: 'MKM', department: 'MKT' },
    { name: 'Accountant', code: 'ACC', department: 'FIN' },
    { name: 'Finance Manager', code: 'FM', department: 'FIN' },
    { name: 'HR Executive', code: 'HRE', department: 'HR' },
    { name: 'HR Manager', code: 'HRM', department: 'HR' },
  ];
  const designations = {};
  for (const def of designationDefs) {
    designations[def.code] = await Designation.create({
      name: def.name,
      code: def.code,
      department: departments[def.department]._id,
    });
  }
  console.log('[seed] Created', designationDefs.length, 'designations');

  // ---------------------------------------------------------------------
  // Leave types
  // ---------------------------------------------------------------------
  const leaveTypeDefs = [
    { name: 'Casual Leave', defaultDaysPerYear: 12, description: 'For short personal needs' },
    { name: 'Sick Leave', defaultDaysPerYear: 10, description: 'For illness or medical needs' },
    { name: 'Paid Leave', defaultDaysPerYear: 15, description: 'Planned time off, deducted from annual allowance' },
  ];
  const leaveTypes = [];
  for (const def of leaveTypeDefs) {
    leaveTypes.push(await LeaveType.create(def));
  }
  console.log('[seed] Created', leaveTypes.length, 'leave types');

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // Helper to create a User + Employee pair together.
  async function createPerson({
    email, role, firstName, lastName, gender, dob, joiningDate,
    departmentCode, designationCode, manager = null, employmentType = 'Full-Time',
  }) {
    const count = await Employee.countDocuments();
    const employeeId = `EMP${String(count + 1).padStart(4, '0')}`;

    const employee = await Employee.create({
      employeeId,
      firstName,
      lastName,
      email,
      phone: `+91 9${randomInt(100000000, 999999999)}`,
      dob,
      gender,
      joiningDate,
      department: departments[departmentCode]._id,
      designation: designations[designationCode]._id,
      manager,
      employmentType,
      status: 'active',
      address: { city: pick(['Mumbai', 'Bengaluru', 'Pune', 'Delhi', 'Hyderabad']), country: 'India' },
    });

    const user = await User.create({ email, passwordHash, role, employee: employee._id });
    employee.user = user._id;
    await employee.save();

    return employee;
  }

  // ---------------------------------------------------------------------
  // Super Admin (no Employee profile — a pure system account)
  // ---------------------------------------------------------------------
  await User.create({ email: 'admin@hrms.local', passwordHash, role: 'SUPER_ADMIN' });

  // ---------------------------------------------------------------------
  // HR Admin
  // ---------------------------------------------------------------------
  const hrAdmin = await createPerson({
    email: 'hr@hrms.local',
    role: 'HR_ADMIN',
    firstName: 'Priya',
    lastName: 'Sharma',
    gender: 'Female',
    dob: new Date('1988-04-12'),
    joiningDate: new Date('2021-01-10'),
    departmentCode: 'HR',
    designationCode: 'HRM',
  });

  // ---------------------------------------------------------------------
  // Managers
  // ---------------------------------------------------------------------
  const engManager = await createPerson({
    email: 'arjun.mehta@hrms.local',
    role: 'MANAGER',
    firstName: 'Arjun',
    lastName: 'Mehta',
    gender: 'Male',
    dob: new Date('1985-09-23'),
    joiningDate: new Date('2020-06-01'),
    departmentCode: 'ENG',
    designationCode: 'EM',
  });

  const salesManager = await createPerson({
    email: 'sara.khan@hrms.local',
    role: 'MANAGER',
    firstName: 'Sara',
    lastName: 'Khan',
    gender: 'Female',
    dob: new Date('1987-02-17'),
    joiningDate: new Date('2020-08-15'),
    departmentCode: 'SALES',
    designationCode: 'SLM',
  });

  // Departments get a head now that we have employees to assign.
  departments.ENG.head = engManager._id;
  await departments.ENG.save();
  departments.SALES.head = salesManager._id;
  await departments.SALES.save();
  departments.HR.head = hrAdmin._id;
  await departments.HR.save();

  // ---------------------------------------------------------------------
  // Regular employees
  // ---------------------------------------------------------------------
  const employeeDefs = [
    { firstName: 'Rohan', lastName: 'Verma', departmentCode: 'ENG', designationCode: 'SSE', manager: engManager._id, gender: 'Male' },
    { firstName: 'Ananya', lastName: 'Iyer', departmentCode: 'ENG', designationCode: 'SE', manager: engManager._id, gender: 'Female' },
    { firstName: 'Karan', lastName: 'Joshi', departmentCode: 'ENG', designationCode: 'SE', manager: engManager._id, gender: 'Male' },
    { firstName: 'Meera', lastName: 'Nair', departmentCode: 'ENG', designationCode: 'SE', manager: engManager._id, gender: 'Female' },
    { firstName: 'Vikram', lastName: 'Rao', departmentCode: 'ENG', designationCode: 'SSE', manager: engManager._id, gender: 'Male' },
    { firstName: 'Divya', lastName: 'Pillai', departmentCode: 'SALES', designationCode: 'SLE', manager: salesManager._id, gender: 'Female' },
    { firstName: 'Aditya', lastName: 'Kapoor', departmentCode: 'SALES', designationCode: 'SLE', manager: salesManager._id, gender: 'Male' },
    { firstName: 'Ishita', lastName: 'Bose', departmentCode: 'SALES', designationCode: 'SLE', manager: salesManager._id, gender: 'Female' },
    { firstName: 'Nikhil', lastName: 'Choudhary', departmentCode: 'MKT', designationCode: 'MKM', manager: null, gender: 'Male' },
    { firstName: 'Pooja', lastName: 'Desai', departmentCode: 'MKT', designationCode: 'MKS', manager: null, gender: 'Female' },
    { firstName: 'Sameer', lastName: 'Malhotra', departmentCode: 'MKT', designationCode: 'MKS', manager: null, gender: 'Male' },
    { firstName: 'Kavya', lastName: 'Reddy', departmentCode: 'FIN', designationCode: 'FM', manager: null, gender: 'Female' },
    { firstName: 'Rahul', lastName: 'Gupta', departmentCode: 'FIN', designationCode: 'ACC', manager: null, gender: 'Male' },
    { firstName: 'Tanvi', lastName: 'Agarwal', departmentCode: 'HR', designationCode: 'HRE', manager: hrAdmin._id, gender: 'Female' },
    { firstName: 'Yash', lastName: 'Trivedi', departmentCode: 'ENG', designationCode: 'SE', manager: engManager._id, gender: 'Male' },
  ];

  const employees = [hrAdmin, engManager, salesManager];
  for (const def of employeeDefs) {
    const email = `${def.firstName.toLowerCase()}.${def.lastName.toLowerCase()}@hrms.local`;
    const employee = await createPerson({
      email,
      role: 'EMPLOYEE',
      firstName: def.firstName,
      lastName: def.lastName,
      gender: def.gender,
      dob: new Date(randomInt(1990, 2000), randomInt(0, 11), randomInt(1, 28)),
      joiningDate: new Date(randomInt(2022, 2025), randomInt(0, 11), randomInt(1, 28)),
      departmentCode: def.departmentCode,
      designationCode: def.designationCode,
      manager: def.manager,
    });
    employees.push(employee);
  }
  console.log('[seed] Created', employees.length, 'employees (with logins) across', departmentDefs.length, 'departments');

  // ---------------------------------------------------------------------
  // Salaries — every employee gets a realistic salary structure
  // ---------------------------------------------------------------------
  for (const employee of employees) {
    const basic = randomInt(35, 90) * 1000;
    await Salary.create({
      employee: employee._id,
      basic,
      hra: Math.round(basic * 0.4),
      allowances: randomInt(3, 10) * 1000,
      deductions: randomInt(2, 6) * 1000,
    });
  }
  console.log('[seed] Configured salaries for all employees');

  // ---------------------------------------------------------------------
  // Attendance — last 14 calendar days, skipping weekends, mostly Present
  // ---------------------------------------------------------------------
  let attendanceCount = 0;
  for (const employee of employees) {
    for (let i = 13; i >= 0; i--) {
      const day = startOfDay(new Date());
      day.setDate(day.getDate() - i);
      if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends

      const roll = Math.random();
      if (roll < 0.05) continue; // ~5% unmarked (shows as absent in reports)

      const checkInHour = randomInt(9, 10);
      const checkInMinute = randomInt(0, 59);
      const checkIn = new Date(day);
      checkIn.setHours(checkInHour, checkInMinute);

      const isHalfDay = roll < 0.12;
      const hoursWorked = isHalfDay ? randomInt(3, 5) : randomInt(8, 9);
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkOut.getHours() + hoursWorked);

      await Attendance.create({
        employee: employee._id,
        date: day,
        checkIn,
        checkOut,
        workingHours: hoursWorked,
        status: isHalfDay ? 'HalfDay' : 'Present',
      });
      attendanceCount++;
    }
  }
  console.log('[seed] Created', attendanceCount, 'attendance records (last 14 working days)');

  // ---------------------------------------------------------------------
  // Leave requests — a realistic mix of pending/approved/rejected
  // ---------------------------------------------------------------------
  const regularEmployees = employees.filter((e) => ![hrAdmin, engManager, salesManager].includes(e));
  let leaveCount = 0;
  for (const employee of regularEmployees.slice(0, 8)) {
    const leaveType = pick(leaveTypes);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + randomInt(-20, 10));
    const days = randomInt(1, 3);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);

    const status = pick(['Pending', 'Approved', 'Approved', 'Rejected']);
    const approverEmployee = employee.manager ? employees.find((e) => e._id.equals(employee.manager)) : hrAdmin;

    const leaveRequest = await LeaveRequest.create({
      employee: employee._id,
      leaveType: leaveType._id,
      startDate,
      endDate,
      days,
      reason: pick([
        'Family function',
        'Not feeling well',
        'Personal errand',
        'Travelling out of town',
        'Medical appointment',
      ]),
      status,
      approver: status === 'Pending' ? null : approverEmployee?._id || null,
      approverComment: status === 'Rejected' ? 'Team is short-staffed this week' : '',
    });

    await Approval.create({
      requestType: 'LEAVE',
      requestId: leaveRequest._id,
      requestedBy: employee._id,
      approver: approverEmployee?._id || null,
      status: status === 'Pending' ? 'Pending' : status,
      comment: leaveRequest.approverComment,
      actionDate: status === 'Pending' ? null : new Date(),
    });

    leaveCount++;
  }
  console.log('[seed] Created', leaveCount, 'leave requests');

  // ---------------------------------------------------------------------
  // Payroll — last 2 months, all Paid except the most recent (Processed)
  // ---------------------------------------------------------------------
  function monthString(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  let payrollCount = 0;
  for (const employee of employees) {
    const salary = await Salary.findOne({ employee: employee._id });
    for (let offset = 2; offset >= 0; offset--) {
      const grossSalary = salary.basic + salary.hra + salary.allowances;
      const netSalary = grossSalary - salary.deductions;
      await Payroll.create({
        employee: employee._id,
        month: monthString(offset),
        basic: salary.basic,
        hra: salary.hra,
        allowances: salary.allowances,
        deductions: salary.deductions,
        grossSalary,
        netSalary,
        status: offset === 0 ? 'Processed' : 'Paid',
      });
      payrollCount++;
    }
  }
  console.log('[seed] Created', payrollCount, 'payroll records (last 3 months)');

  // ---------------------------------------------------------------------
  // A few notifications for the HR admin and managers
  // ---------------------------------------------------------------------
  const hrUser = await User.findOne({ email: 'hr@hrms.local' });
  await Notification.create([
    { user: hrUser._id, title: 'Welcome to Enterprise HRMS', message: 'Your demo workspace is ready to explore.', type: 'GENERAL' },
    { user: hrUser._id, title: 'New leave request', message: 'A team member has requested leave.', type: 'LEAVE', link: '/leaves/approvals' },
  ]);
  console.log('[seed] Created sample notifications');

  await mongoose.disconnect();

  console.log('\n[seed] Done! Demo login credentials (all use the same password):\n');
  console.log(`  Password for every account: ${DEMO_PASSWORD}\n`);
  console.log('  SUPER_ADMIN : admin@hrms.local');
  console.log('  HR_ADMIN    : hr@hrms.local');
  console.log('  MANAGER     : arjun.mehta@hrms.local  (Engineering)');
  console.log('  MANAGER     : sara.khan@hrms.local    (Sales)');
  console.log('  EMPLOYEE    : rohan.verma@hrms.local  (and 14 more — see README)');
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
