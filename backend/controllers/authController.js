const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');

const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return jwt.sign({ id: userId }, secret, { expiresIn: '7d' });
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'Username or email already in use' });
    }

    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);

    return res.status(201).json({ token, user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    return res.status(200).json({ token, user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const registerValidation = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

module.exports = { register, login, registerValidation, loginValidation };
