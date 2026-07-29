const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/', notificationController.listNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

module.exports = router;
