const router = require('express').Router();
const payrollController = require('../controllers/payroll.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { idParam } = require('../validations/common');
const {
  salarySchema,
  generatePayrollSchema,
  updatePayrollStatusSchema,
  listPayrollQuery,
  myPayrollQuery,
  employeeIdParam,
} = require('../validations/payroll.validation');

router.use(authenticate);

// Self-service
router.get('/me', validate.query(myPayrollQuery), payrollController.getMyPayroll);

// Salary — view is self-or-HR (checked inside controller), edit is HR only.
router.get('/salaries', requireRole('HR_ADMIN', 'SUPER_ADMIN'), payrollController.listSalaries);
router.get('/salary/:employeeId', validate.params(employeeIdParam), payrollController.getSalary);
router.put(
  '/salary/:employeeId',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(employeeIdParam),
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
router.get('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate.query(listPayrollQuery), payrollController.listPayroll);
// Payslip detail — self-or-HR is enforced inside the controller.
router.get('/:id', validate.params(idParam), payrollController.getPayroll);
router.patch(
  '/:id/status',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(idParam),
  validate(updatePayrollStatusSchema),
  payrollController.updatePayrollStatus
);

module.exports = router;
