const router = require('express').Router();
const employeeController = require('../controllers/employee.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { idParam } = require('../validations/common');
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateStatusSchema,
  listEmployeesQuery,
  quickSearchQuery,
} = require('../validations/employee.validation');

router.use(authenticate);

// List/detail: available to everyone, but scoped per-role inside the
// controller — MANAGER only sees their direct reports, EMPLOYEE gets the
// directory view (no personal fields) for anyone but themselves.
router.get('/', validate.query(listEmployeesQuery), employeeController.listEmployees);
router.get('/search', validate.query(quickSearchQuery), employeeController.quickSearch);
router.get('/options', employeeController.listEmployeeOptions);
router.get('/:id', validate.params(idParam), employeeController.getEmployee);

router.post('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(createEmployeeSchema), employeeController.createEmployee);
router.put(
  '/:id',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(idParam),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee
);
router.patch(
  '/:id/status',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(idParam),
  validate(updateStatusSchema),
  employeeController.updateEmployeeStatus
);
router.post('/:id/profile-image', validate.params(idParam), upload.single('profileImage'), employeeController.uploadProfileImage);

module.exports = router;
