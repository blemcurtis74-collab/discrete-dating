const { validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const User = require('../models/User');

/**
 * POST /api/payments/create-payment-intent
 * Create a Stripe PaymentIntent for a one-time charge (e.g. premium feature).
 */
const createPaymentIntent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { amount, currency = 'usd' } = req.body;

  try {
    const user = await User.findById(req.user.id).select('+stripeCustomerId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Lazily create a Stripe Customer for this user
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await User.findByIdAndUpdate(req.user.id, { stripeCustomerId: customerId });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      metadata: { userId: req.user.id.toString() },
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    return res.status(500).json({ message: 'Payment error', error: err.message });
  }
};

/**
 * POST /api/payments/webhook
 * Handle Stripe webhook events (e.g. subscription lifecycle).
 * Expects raw body – configure express to pass raw body for this route.
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const status = subscription.status === 'active' ? 'active' : 'inactive';
      await User.findOneAndUpdate(
        { stripeCustomerId: subscription.customer },
        { subscriptionStatus: status }
      );
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await User.findOneAndUpdate(
        { stripeCustomerId: subscription.customer },
        { subscriptionStatus: 'cancelled' }
      );
      break;
    }
    default:
      break;
  }

  return res.json({ received: true });
};

module.exports = { createPaymentIntent, handleWebhook };
