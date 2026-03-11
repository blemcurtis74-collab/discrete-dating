const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');
const { generalLimiter } = require('../middleware/rateLimiter');
const {
  sendMessage,
  getConversation,
  getConversations,
  deleteMessage,
  sendMessageValidation,
  getConversationValidation,
  deleteMessageValidation,
} = require('../controllers/messageController');

// List all conversations
router.get('/', generalLimiter, auth, getConversations);

// Get conversation with a specific user
router.get('/:otherUserId', generalLimiter, auth, getConversationValidation, validateRequest, getConversation);

// Send a message to a matched user
router.post('/:receiverId', generalLimiter, auth, sendMessageValidation, validateRequest, sendMessage);

// Soft-delete a message
router.delete('/:messageId', generalLimiter, auth, deleteMessageValidation, validateRequest, deleteMessage);

module.exports = router;
