const router = require('express').Router();
const auditLogController = require('../controllers/auditLog.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

router.use(authenticate, requireRole('HR_ADMIN', 'SUPER_ADMIN'));

router.get('/', auditLogController.listAuditLogs);
router.get('/actions', auditLogController.listDistinctActions);

module.exports = router;
