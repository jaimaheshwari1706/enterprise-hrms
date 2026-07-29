const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validations/auth.validation');

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshTokenHandler);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
