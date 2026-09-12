const mongoose = require('mongoose');

// A public holiday. `date` is a business-calendar day key (UTC midnight of
// the calendar day — the same convention as Attendance.date and
// LeaveRequest.startDate, see utils/dateHelpers) so holidays, leave days and
// attendance days can be compared with plain equality.
const holidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { _id: false }
);

// A single-tenant app only ever has ONE organization document. We still
// model it as a collection (rather than a config file) so it can be
// managed through the same CRUD-style API/UI patterns as everything else.
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    logoUrl: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    country: { type: String, default: '' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    // Working week. Anything not listed is a weekend for leave counting,
    // attendance absence and (when enabled) payroll pro-rating.
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    // Public holidays, kept on the organization document (a single tenant
    // has a few dozen per year at most — not worth its own collection).
    holidays: { type: [holidaySchema], default: [] },
    officeStartTime: { type: String, default: '09:30' },
    officeEndTime: { type: String, default: '18:30' },
    // Payroll rules that are genuinely a business decision rather than a
    // fact of the data. Defaults keep the historical behaviour (fixed
    // monthly salary regardless of days worked) until HR opts in.
    payrollPolicy: {
      // How partial months are paid:
      //   none     - full monthly salary regardless of joining/exit date
      //   calendar - salary × (payable calendar days / calendar days in month)
      //   working  - salary × (payable working days / working days in month)
      proRataBasis: { type: String, enum: ['none', 'calendar', 'working'], default: 'none' },
      // Whether approved leave of an *unpaid* leave type (LeaveType.isPaid =
      // false) reduces payable days. Requires proRataBasis !== 'none'.
      deductUnpaidLeave: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
