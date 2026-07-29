const router = require('express').Router();
const employeeController = require('../controllers/employee.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateStatusSchema,
} = require('../validations/employee.validation');

router.use(authenticate);

// List/detail: available to everyone, but scoped per-role inside the
// controller (MANAGER only sees their direct reports; EMPLOYEE effectively
// only ever fetches their own record via /profile — see Phase 14).
router.get('/', employeeController.listEmployees);
router.get('/search', employeeController.quickSearch);
router.get('/:id', employeeController.getEmployee);

router.post('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(createEmployeeSchema), employeeController.createEmployee);
router.put('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(updateEmployeeSchema), employeeController.updateEmployee);
router.patch(
  '/:id/status',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate(updateStatusSchema),
  employeeController.updateEmployeeStatus
);
router.post('/:id/profile-image', upload.single('profileImage'), employeeController.uploadProfileImage);

module.exports = router;
