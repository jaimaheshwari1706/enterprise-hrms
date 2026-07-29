const router = require('express').Router();
const departmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { departmentSchema } = require('../validations/department.validation');

router.use(authenticate);

// Any authenticated user can view departments (needed for dropdowns on
// the employee form, filters, etc). Only HR_ADMIN/SUPER_ADMIN can mutate.
router.get('/', departmentController.listDepartments);
router.get('/:id', departmentController.getDepartment);
router.post('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(departmentSchema), departmentController.createDepartment);
router.put('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(departmentSchema), departmentController.updateDepartment);
router.delete('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), departmentController.deleteDepartment);

module.exports = router;
