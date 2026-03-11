const { Router } = require('express');
const { body } = require('express-validator');
const { register, login } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');

const router = Router();

router.use(authLimiter);

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('displayName')
      .trim()
      .notEmpty()
      .withMessage('Display name is required')
      .isLength({ max: 50 })
      .withMessage('Display name must not exceed 50 characters'),
  ],
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

module.exports = router;
