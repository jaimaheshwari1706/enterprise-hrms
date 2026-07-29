const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['LEAVE', 'EMPLOYEE', 'PAYROLL', 'GENERAL'],
      default: 'GENERAL',
    },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
