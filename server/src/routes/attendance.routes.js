const router = require('express').Router();
const attendanceController = require('../controllers/attendance.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { listAttendanceQuery, myHistoryQuery } = require('../validations/attendance.validation');

router.use(authenticate);

// Self-service endpoints — any authenticated user with a linked employee profile.
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/me/today', attendanceController.getTodayAttendance);
router.get('/me/history', validate.query(myHistoryQuery), attendanceController.getMyHistory);

// HR/Manager view — scoped to the team inside the controller for MANAGER.
router.get(
  '/',
  requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  validate.query(listAttendanceQuery),
  attendanceController.listAttendance
);

module.exports = router;
