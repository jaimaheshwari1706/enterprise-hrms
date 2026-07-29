const mongoose = require('mongoose');

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
  },
  { timestamps: true }
);

// One payroll record per employee per month.
payrollSchema.index({ employee: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
