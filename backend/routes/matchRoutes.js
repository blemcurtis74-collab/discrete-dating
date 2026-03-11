const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { createMatch, getMatches, createMatchValidation } = require('../controllers/matchController');
const { generalLimiter } = require('../middleware/rateLimiter');

router.post('/:userId', generalLimiter, auth, createMatchValidation, validateRequest, createMatch);
router.get('/', generalLimiter, auth, getMatches);

module.exports = router;
