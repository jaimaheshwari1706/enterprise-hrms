const { Notification } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');

// GET /api/notifications?page=&limit=
const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = { user: req.user._id };

  const [data, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  return ok(res, {
    message: 'Notifications',
    data: { items: data, unreadCount },
    pagination: buildPaginationMeta(page, limit, total),
  });
});

// PATCH /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');

  notification.isRead = true;
  await notification.save();

  return ok(res, { message: 'Notification marked as read', data: notification });
});

// PATCH /api/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  return ok(res, { message: 'All notifications marked as read' });
});

module.exports = { listNotifications, markAsRead, markAllAsRead };
