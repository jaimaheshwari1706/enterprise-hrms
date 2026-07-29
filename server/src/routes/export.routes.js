const router = require('express').Router();
const exportController = require('../controllers/export.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

router.use(authenticate, requireRole('HR_ADMIN', 'SUPER_ADMIN'));

router.get('/employees.xlsx', exportController.exportEmployees);
router.get('/attendance.xlsx', exportController.exportAttendance);
router.get('/leaves.xlsx', exportController.exportLeaves);
router.get('/payroll.xlsx', exportController.exportPayroll);

module.exports = router;
