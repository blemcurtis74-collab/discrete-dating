const express = require('express');
const router = express.Router();
const { register, login, registerValidation, loginValidation } = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, registerValidation, validateRequest, register);
router.post('/login', authLimiter, loginValidation, validateRequest, login);

module.exports = router;
