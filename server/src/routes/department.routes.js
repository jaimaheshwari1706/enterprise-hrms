const router = require('express').Router();
const departmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { idParam } = require('../validations/common');
const { departmentSchema, listDepartmentsQuery } = require('../validations/department.validation');

router.use(authenticate);

// Any authenticated user can view departments (needed for dropdowns on
// the employee form, filters, etc). Only HR_ADMIN/SUPER_ADMIN can mutate.
router.get('/', validate.query(listDepartmentsQuery), departmentController.listDepartments);
router.get('/:id', validate.params(idParam), departmentController.getDepartment);
router.post('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(departmentSchema), departmentController.createDepartment);
router.put(
  '/:id',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(idParam),
  validate(departmentSchema),
  departmentController.updateDepartment
);
router.delete('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate.params(idParam), departmentController.deleteDepartment);

module.exports = router;
