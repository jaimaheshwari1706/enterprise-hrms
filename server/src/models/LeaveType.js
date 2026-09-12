const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // Casual Leave, Sick Leave, Paid Leave
    defaultDaysPerYear: { type: Number, required: true, default: 12 },
    description: { type: String, default: '' },
    // Paid leave keeps the salary whole; unpaid leave (loss of pay) can
    // reduce payable days when the organization's payroll policy enables
    // it. Defaults to paid so existing leave types behave exactly as before.
    isPaid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
