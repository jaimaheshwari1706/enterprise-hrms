const mongoose = require('mongoose');

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
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    officeStartTime: { type: String, default: '09:30' },
    officeEndTime: { type: String, default: '18:30' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
