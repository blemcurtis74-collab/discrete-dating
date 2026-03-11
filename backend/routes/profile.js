const { Router } = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteProfile,
} = require('../controllers/profileController');

const router = Router();

// All profile routes require authentication and are rate-limited
router.use(apiLimiter);
router.use(auth);

router.get('/', getProfile);

router.put(
  '/',
  [
    body('displayName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Display name must not be blank')
      .isLength({ max: 50 })
      .withMessage('Display name must not exceed 50 characters'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),
    body('age')
      .optional()
      .isInt({ min: 18, max: 120 })
      .withMessage('Age must be between 18 and 120'),
    body('gender')
      .optional()
      .isIn(['male', 'female', 'non-binary', 'prefer not to say', ''])
      .withMessage('Invalid gender value'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array'),
    body('location').optional().isObject().withMessage('Location must be an object'),
    body('profileVisible')
      .optional()
      .isBoolean()
      .withMessage('profileVisible must be a boolean'),
  ],
  updateProfile
);

router.put(
  '/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  changePassword
);

router.delete('/', deleteProfile);

module.exports = router;
