const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { idParam } = require('../validations/common');
const { listNotificationsQuery } = require('../validations/notification.validation');

router.use(authenticate);

router.get('/', validate.query(listNotificationsQuery), notificationController.listNotifications);
// Static path must be registered before the `/:id/read` matcher.
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', validate.params(idParam), notificationController.markAsRead);

module.exports = router;
