const { Notification } = require('../models');

// Only the "write" side is built here — other modules (leave approvals,
// employee creation, payroll) can start creating notifications as soon as
// the event happens. The "read" side (list, unread count, mark as read)
// is a dedicated Module 11 API built in Phase 10.
async function notify({ user, title, message, type = 'GENERAL', link = '' }) {
  if (!user) return null;
  try {
    return await Notification.create({ user, title, message, type, link });
  } catch (err) {
    console.error('[notifications] failed to create notification:', err.message);
    return null;
  }
}

module.exports = { notify };
