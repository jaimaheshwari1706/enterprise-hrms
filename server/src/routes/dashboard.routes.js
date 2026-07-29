const router = require('express').Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');

router.use(authenticate);

router.get('/hr', requireRole('HR_ADMIN', 'SUPER_ADMIN'), dashboardController.getHRDashboard);
router.get('/manager', requireRole('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'), dashboardController.getManagerDashboard);
router.get('/employee', dashboardController.getEmployeeDashboard);

module.exports = router;
