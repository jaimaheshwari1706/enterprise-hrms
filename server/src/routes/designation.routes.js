const router = require('express').Router();
const designationController = require('../controllers/designation.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { designationSchema } = require('../validations/designation.validation');

router.use(authenticate);

router.get('/', designationController.listDesignations);
router.get('/:id', designationController.getDesignation);
router.post('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(designationSchema), designationController.createDesignation);
router.put('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(designationSchema), designationController.updateDesignation);
router.delete('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), designationController.deleteDesignation);

module.exports = router;
