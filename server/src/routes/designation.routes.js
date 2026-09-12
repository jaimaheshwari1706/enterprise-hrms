const router = require('express').Router();
const designationController = require('../controllers/designation.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { idParam } = require('../validations/common');
const { designationSchema, listDesignationsQuery } = require('../validations/designation.validation');

router.use(authenticate);

router.get('/', validate.query(listDesignationsQuery), designationController.listDesignations);
router.get('/:id', validate.params(idParam), designationController.getDesignation);
router.post('/', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate(designationSchema), designationController.createDesignation);
router.put(
  '/:id',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate.params(idParam),
  validate(designationSchema),
  designationController.updateDesignation
);
router.delete('/:id', requireRole('HR_ADMIN', 'SUPER_ADMIN'), validate.params(idParam), designationController.deleteDesignation);

module.exports = router;
