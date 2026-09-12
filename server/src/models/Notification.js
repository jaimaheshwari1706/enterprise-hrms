const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

// Feed (newest first) and unread badge count are the only two queries.
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
// In-app notifications are ephemeral: MongoDB purges them after 180 days so
// the collection doesn't grow by every leave/payroll event forever. The
// audit log (not this collection) is the permanent record.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
