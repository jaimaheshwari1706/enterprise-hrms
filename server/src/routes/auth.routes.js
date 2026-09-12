const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sessionIdParam,
} = require('../validations/auth.validation');

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', refreshLimiter, authController.refreshTokenHandler);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/sessions', authenticate, authController.sessions);
router.delete('/sessions/:id', authenticate, validate.params(sessionIdParam), authController.revokeSession);
router.get('/me', authenticate, authController.me);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
