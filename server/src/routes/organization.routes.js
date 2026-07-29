const router = require('express').Router();
const organizationController = require('../controllers/organization.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { updateOrganizationSchema } = require('../validations/organization.validation');

router.use(authenticate);

router.get('/', organizationController.getOrganization);
router.put(
  '/',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  validate(updateOrganizationSchema),
  organizationController.updateOrganization
);
router.post(
  '/logo',
  requireRole('HR_ADMIN', 'SUPER_ADMIN'),
  upload.single('logo'),
  organizationController.uploadLogo
);

module.exports = router;
