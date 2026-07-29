const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    // Stored as a plain date (midnight) so `(employee, date)` can be a
    // simple unique compound index — one attendance record per day.
    date: { type: Date, required: true },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    workingHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'HalfDay', 'Leave'],
      default: 'Absent',
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
