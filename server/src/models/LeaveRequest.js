const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true }, // computed at apply-time (inclusive day count)
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending',
    },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    approverComment: { type: String, default: '' },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
