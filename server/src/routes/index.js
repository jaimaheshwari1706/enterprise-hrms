const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/organization', require('./organization.routes'));
router.use('/departments', require('./department.routes'));
router.use('/designations', require('./designation.routes'));
router.use('/employees', require('./employee.routes'));
router.use('/attendance', require('./attendance.routes'));
router.use('/leaves', require('./leave.routes'));
router.use('/payroll', require('./payroll.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/audit-logs', require('./auditLog.routes'));
router.use('/profile', require('./profile.routes'));
router.use('/export', require('./export.routes'));
router.use('/search', require('./search.routes'));

module.exports = router;
