const router = require('express').Router();
const leaveController = require('../controllers/leave.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { idParam } = require('../validations/common');
const {
  applyLeaveSchema,
  previewLeaveQuery,
  decisionSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  listLeavesQuery,
  myLeavesQuery,
} = require('../validations/leave.validation');

router.use(authenticate);

// Leave types: everyone can read them, only HR can manage them.
router.get('/leave-types', leaveController.listLeaveTypes);
router.post('/leave-types', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(createLeaveTypeSchema), leaveController.createLeaveType);
router.put(
  '/leave-types/:id',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(idParam),
  validate(updateLeaveTypeSchema),
  leaveController.updateLeaveType
);

// Self-service
router.get('/preview', validate.query(previewLeaveQuery), leaveController.previewLeaveDays);
router.post('/apply', validate(applyLeaveSchema), leaveController.applyLeave);
router.get('/me', validate.query(myLeavesQuery), leaveController.getMyLeaves);
router.get('/me/balance', leaveController.getMyLeaveBalance);
router.patch('/:id/cancel', validate.params(idParam), leaveController.cancelLeave);

// HR/Manager approvals
router.get('/', requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'), validate.query(listLeavesQuery), leaveController.listLeaveRequests);
router.patch(
  '/:id/approve',
  requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  validate.params(idParam),
  validate(decisionSchema),
  leaveController.approveLeave
);
router.patch(
  '/:id/reject',
  requireRole('HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  validate.params(idParam),
  validate(decisionSchema),
  leaveController.rejectLeave
);

module.exports = router;
