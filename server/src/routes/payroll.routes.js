const router = require('express').Router();
const payrollController = require('../controllers/payroll.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  salarySchema,
  generatePayrollSchema,
  updatePayrollStatusSchema,
} = require('../validations/payroll.validation');

router.use(authenticate);

// Self-service
router.get('/me', payrollController.getMyPayroll);

// Salary — view is self-or-HR (checked inside controller), edit is HR only.
router.get('/salary/:employeeId', payrollController.getSalary);
router.put(
  '/salary/:employeeId',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate(salarySchema),
  payrollController.updateSalary
);

// HR payroll management
router.post(
  '/generate',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate(generatePayrollSchema),
  payrollController.generatePayroll
);
router.get('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), payrollController.listPayroll);
router.patch(
  '/:id/status',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate(updatePayrollStatusSchema),
  payrollController.updatePayrollStatus
);

module.exports = router;
