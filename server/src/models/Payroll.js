const mongoose = require('mongoose');

// Snapshot of how the amounts were arrived at, so a payslip can show
// "26 of 31 days" and an audit can reproduce the figure after the
// organization's policy or the employee's salary structure changes.
const periodSchema = new mongoose.Schema(
  {
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    basis: { type: String, enum: ['none', 'calendar', 'working'], default: 'none' },
    totalDays: { type: Number, default: null },
    employedDays: { type: Number, default: null },
    unpaidLeaveDays: { type: Number, default: 0 },
    payableDays: { type: Number, default: null },
    factor: { type: Number, default: 1 },
    monthCalendarDays: { type: Number, default: null },
    monthWorkingDays: { type: Number, default: null },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true }, // "YYYY-MM"
    basic: { type: Number, required: true },
    hra: { type: Number, required: true },
    allowances: { type: Number, required: true },
    deductions: { type: Number, required: true },
    grossSalary: { type: Number, required: true },
    netSalary: { type: Number, required: true },
    status: { type: String, enum: ['Draft', 'Processed', 'Paid'], default: 'Draft' },
    // Pro-rata / payable-day snapshot (see utils/payrollCalculations).
    // Records generated before this field existed simply carry defaults.
    period: { type: periodSchema, default: () => ({}) },
    // Human-readable payslip reference, assigned when the record is created.
    payslipNumber: { type: String, default: null },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One payroll record per employee per month.
payrollSchema.index({ employee: 1, month: 1 }, { unique: true });
// Dashboard totals and the HR list filter by month (optionally + status).
payrollSchema.index({ month: -1, status: 1 });
// Payslip lookup by reference. A partial index (not `sparse`) because
// Mongoose stores the default `null` explicitly, and a sparse unique index
// would treat every null as the same duplicate value.
payrollSchema.index({ payslipNumber: 1 }, { unique: true, partialFilterExpression: { payslipNumber: { $type: 'string' } } });

module.exports = mongoose.model('Payroll', payrollSchema);
