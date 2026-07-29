const ExcelJS = require('exceljs');
const { Employee, Attendance, LeaveRequest, Payroll } = require('../models');
const { startOfDay, endOfDay } = require('../utils/dateHelpers');
const asyncHandler = require('../utils/asyncHandler');

// Builds a workbook from column defs + rows and streams it directly to the
// response — no temp files on disk, which keeps this simple and stateless.
async function sendWorkbook(res, filename, sheetName, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

// GET /api/export/employees.xlsx?search=&department=&designation=&status=
const exportEmployees = asyncHandler(async (req, res) => {
  const { search, department, designation, status } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (designation) filter.designation = designation;
  if (status) filter.status = status;
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { email: regex }];
  }

  const employees = await Employee.find(filter).populate('department', 'name').populate('designation', 'name');

  await sendWorkbook(
    res,
    'employees.xlsx',
    'Employees',
    [
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'First Name', key: 'firstName', width: 16 },
      { header: 'Last Name', key: 'lastName', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Designation', key: 'designation', width: 18 },
      { header: 'Employment Type', key: 'employmentType', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Joining Date', key: 'joiningDate', width: 14 },
    ],
    employees.map((e) => ({
      employeeId: e.employeeId,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone,
      department: e.department?.name || '',
      designation: e.designation?.name || '',
      employmentType: e.employmentType,
      status: e.status,
      joiningDate: e.joiningDate?.toISOString().slice(0, 10),
    }))
  );
});

// GET /api/export/attendance.xlsx?employee=&from=&to=&status=
const exportAttendance = asyncHandler(async (req, res) => {
  const { employee, from, to, status } = req.query;
  const filter = {};
  if (employee) filter.employee = employee;
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDay(new Date(from));
    if (to) filter.date.$lte = endOfDay(new Date(to));
  }

  const records = await Attendance.find(filter).populate('employee', 'firstName lastName employeeId').sort({ date: -1 });

  await sendWorkbook(
    res,
    'attendance.xlsx',
    'Attendance',
    [
      { header: 'Employee', key: 'employee', width: 24 },
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Check In', key: 'checkIn', width: 20 },
      { header: 'Check Out', key: 'checkOut', width: 20 },
      { header: 'Working Hours', key: 'workingHours', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ],
    records.map((r) => ({
      employee: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
      employeeId: r.employee?.employeeId || '',
      date: r.date?.toISOString().slice(0, 10),
      checkIn: r.checkIn?.toLocaleString() || '',
      checkOut: r.checkOut?.toLocaleString() || '',
      workingHours: r.workingHours,
      status: r.status,
    }))
  );
});

// GET /api/export/leaves.xlsx?employee=&status=
const exportLeaves = asyncHandler(async (req, res) => {
  const { employee, status } = req.query;
  const filter = {};
  if (employee) filter.employee = employee;
  if (status) filter.status = status;

  const records = await LeaveRequest.find(filter)
    .populate('employee', 'firstName lastName employeeId')
    .populate('leaveType', 'name')
    .sort({ createdAt: -1 });

  await sendWorkbook(
    res,
    'leaves.xlsx',
    'Leave Requests',
    [
      { header: 'Employee', key: 'employee', width: 24 },
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Leave Type', key: 'leaveType', width: 16 },
      { header: 'Start Date', key: 'startDate', width: 14 },
      { header: 'End Date', key: 'endDate', width: 14 },
      { header: 'Days', key: 'days', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reason', key: 'reason', width: 30 },
    ],
    records.map((r) => ({
      employee: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
      employeeId: r.employee?.employeeId || '',
      leaveType: r.leaveType?.name || '',
      startDate: r.startDate?.toISOString().slice(0, 10),
      endDate: r.endDate?.toISOString().slice(0, 10),
      days: r.days,
      status: r.status,
      reason: r.reason,
    }))
  );
});

// GET /api/export/payroll.xlsx?month=&employee=&status=
const exportPayroll = asyncHandler(async (req, res) => {
  const { month, employee, status } = req.query;
  const filter = {};
  if (month) filter.month = month;
  if (employee) filter.employee = employee;
  if (status) filter.status = status;

  const records = await Payroll.find(filter).populate('employee', 'firstName lastName employeeId').sort({ month: -1 });

  await sendWorkbook(
    res,
    'payroll.xlsx',
    'Payroll',
    [
      { header: 'Employee', key: 'employee', width: 24 },
      { header: 'Employee ID', key: 'employeeId', width: 14 },
      { header: 'Month', key: 'month', width: 10 },
      { header: 'Basic', key: 'basic', width: 12 },
      { header: 'HRA', key: 'hra', width: 12 },
      { header: 'Allowances', key: 'allowances', width: 12 },
      { header: 'Deductions', key: 'deductions', width: 12 },
      { header: 'Gross Salary', key: 'grossSalary', width: 14 },
      { header: 'Net Salary', key: 'netSalary', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ],
    records.map((r) => ({
      employee: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
      employeeId: r.employee?.employeeId || '',
      month: r.month,
      basic: r.basic,
      hra: r.hra,
      allowances: r.allowances,
      deductions: r.deductions,
      grossSalary: r.grossSalary,
      netSalary: r.netSalary,
      status: r.status,
    }))
  );
});

module.exports = { exportEmployees, exportAttendance, exportLeaves, exportPayroll };
