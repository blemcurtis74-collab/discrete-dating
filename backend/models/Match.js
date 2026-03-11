const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    users: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      validate: {
        validator: (v) => v.length === 2,
        message: 'A match must have exactly two users.',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure a pair of users only has one match record
matchSchema.index({ users: 1 }, { unique: true });

module.exports = mongoose.model('Match', matchSchema);
