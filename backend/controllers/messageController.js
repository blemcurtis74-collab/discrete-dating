const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Match = require('../models/Match');

/**
 * Verify that the two users share an accepted match.
 */
const verifyMatch = async (userAId, userBId) => {
  const sortedIds = [userAId, userBId].sort();
  const match = await Match.findOne({ users: { $all: sortedIds }, status: 'accepted' });
  return !!match;
};

// POST /api/messages/:receiverId  — send a message
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.params;
    const { content } = req.body;

    if (senderId === receiverId) {
      return res.status(400).json({ message: 'You cannot message yourself' });
    }

    const isMatched = await verifyMatch(senderId, receiverId);
    if (!isMatched) {
      return res.status(403).json({ message: 'You can only message users you have matched with' });
    }

    const message = await Message.create({ sender: senderId, receiver: receiverId, content });
    await message.populate('sender', 'username profilePicture');

    return res.status(201).json({ message });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/messages/:otherUserId  — get conversation with a specific matched user
const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    const isMatched = await verifyMatch(userId, otherUserId);
    if (!isMatched) {
      return res.status(403).json({ message: 'You can only view conversations with matched users' });
    }

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
      deletedBy: { $ne: userId },
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    // Mark unread messages sent by the other user as read
    await Message.updateMany(
      { sender: otherUserId, receiver: userId, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/messages  — list all conversations for the current user
const getConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get the latest message per conversation partner
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
          deletedBy: { $ne: userId },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $addFields: {
          partner: {
            $cond: [{ $eq: ['$sender', userId] }, '$receiver', '$sender'],
          },
        },
      },
      {
        $group: {
          _id: '$partner',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$read', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'partnerDetails',
        },
      },
      { $unwind: '$partnerDetails' },
      {
        $project: {
          'partnerDetails.password': 0,
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    return res.status(200).json({ conversations });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// DELETE /api/messages/:messageId  — soft-delete a message for the current user
const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const isSenderOrReceiver =
      String(message.sender) === userId || String(message.receiver) === userId;
    if (!isSenderOrReceiver) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (message.deletedBy.map(String).includes(userId)) {
      return res.status(409).json({ message: 'Message already deleted' });
    }

    message.deletedBy.push(userId);
    await message.save();

    return res.status(200).json({ message: 'Message deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const sendMessageValidation = [
  param('receiverId')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid receiver ID'),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content cannot be empty')
    .isLength({ max: 2000 })
    .withMessage('Message cannot exceed 2000 characters'),
];

const getConversationValidation = [
  param('otherUserId')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid user ID'),
];

const deleteMessageValidation = [
  param('messageId')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid message ID'),
];

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
  deleteMessage,
  sendMessageValidation,
  getConversationValidation,
  deleteMessageValidation,
};
