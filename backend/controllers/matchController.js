const { body, param } = require('express-validator');
const mongoose = require('mongoose');
const Match = require('../models/Match');
const User = require('../models/User');

// POST /api/matches/:userId  — like / initiate a match with another user
const createMatch = async (req, res) => {
  try {
    const initiatorId = req.user.id;
    const targetId = req.params.userId;

    if (initiatorId === targetId) {
      return res.status(400).json({ message: 'You cannot match with yourself' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build a canonical sorted pair so [A,B] and [B,A] map to the same document
    const sortedIds = [initiatorId, targetId].sort();

    let match = await Match.findOne({ users: { $all: sortedIds } });

    if (match) {
      if (match.status === 'accepted') {
        return res.status(409).json({ message: 'Already matched' });
      }
      // Other user already liked you — accept the match
      if (match.status === 'pending' && String(match.initiator) !== initiatorId) {
        match.status = 'accepted';
        await match.save();
        return res.status(200).json({ message: 'Match accepted!', match });
      }
      return res.status(409).json({ message: 'Match request already sent' });
    }

    match = await Match.create({ users: sortedIds, initiator: initiatorId });
    return res.status(201).json({ message: 'Match request sent', match });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// GET /api/matches  — get all accepted matches for the current user
const getMatches = async (req, res) => {
  try {
    const userId = req.user.id;

    const matches = await Match.find({
      users: userId,
      status: 'accepted',
    }).populate('users', 'username bio profilePicture');

    return res.status(200).json({ matches });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const createMatchValidation = [
  param('userId')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid user ID'),
];

module.exports = { createMatch, getMatches, createMatchValidation };
