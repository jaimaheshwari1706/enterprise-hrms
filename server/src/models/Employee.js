const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    dob: { type: Date, default: null },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Other' },
    joiningDate: { type: Date, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', required: true },
    // Self-reference: lets us build reporting hierarchies (used by the
    // manager dashboard + leave approval routing) without a separate table.
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'],
      default: 'Full-Time',
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    profileImageUrl: { type: String, default: '' },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      zip: { type: String, default: '' },
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Text index powers the Module 15 global search (name / employeeId / email).
employeeSchema.index({ firstName: 'text', lastName: 'text', employeeId: 'text', email: 'text' });

employeeSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});
employeeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
