const router = require('express').Router();
const leaveController = require('../controllers/leave.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { applyLeaveSchema, decisionSchema } = require('../validations/leave.validation');

router.use(authenticate);

router.get('/leave-types', leaveController.listLeaveTypes);

// Self-service
router.post('/apply', validate(applyLeaveSchema), leaveController.applyLeave);
router.get('/me', leaveController.getMyLeaves);
router.patch('/:id/cancel', leaveController.cancelLeave);

// HR/Manager approvals
router.get('/', requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'), leaveController.listLeaveRequests);
router.patch(
  '/:id/approve',
  requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  validate(decisionSchema),
  leaveController.approveLeave
);
router.patch(
  '/:id/reject',
  requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  validate(decisionSchema),
  leaveController.rejectLeave
);

module.exports = router;
