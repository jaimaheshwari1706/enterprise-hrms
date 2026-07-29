const router = require('express').Router();
const profileController = require('../controllers/profile.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { updateProfileSchema, changePasswordSchema } = require('../validations/profile.validation');

router.use(authenticate);

router.get('/me', profileController.getMyProfile);
router.put('/me', validate(updateProfileSchema), profileController.updateMyProfile);
router.put('/me/password', validate(changePasswordSchema), profileController.changeMyPassword);
router.post('/me/avatar', upload.single('avatar'), profileController.uploadMyAvatar);

module.exports = router;
