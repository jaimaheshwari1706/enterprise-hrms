const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
    basic: { type: Number, required: true, default: 0 },
    hra: { type: Number, required: true, default: 0 },
    allowances: { type: Number, required: true, default: 0 },
    deductions: { type: Number, required: true, default: 0 },
    effectiveFrom: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Salary', salarySchema);
