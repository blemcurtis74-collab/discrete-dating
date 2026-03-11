const { Router } = require('express');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');
const { apiLimiter, authLimiter } = require('../middleware/rateLimiter');
const { createPaymentIntent, handleWebhook } = require('../controllers/paymentController');

const router = Router();

// Stripe webhook – raw body required, no JWT auth (verified by Stripe signature)
// Use authLimiter for the webhook to prevent abuse
router.post('/webhook', authLimiter, handleWebhook);

// Authenticated payment routes
router.use(apiLimiter);
router.use(auth);

router.post(
  '/create-payment-intent',
  [
    body('amount')
      .isInt({ min: 50 })
      .withMessage('Amount must be a positive integer (in cents, minimum 50)'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter ISO code'),
  ],
  createPaymentIntent
);

module.exports = router;
