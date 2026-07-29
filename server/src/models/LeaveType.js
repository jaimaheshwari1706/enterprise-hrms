const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // Casual Leave, Sick Leave, Paid Leave
    defaultDaysPerYear: { type: Number, required: true, default: 12 },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
