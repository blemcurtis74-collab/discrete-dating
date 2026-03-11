const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    age: {
      type: Number,
      min: 18,
      max: 120,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'non-binary', 'prefer not to say', ''],
      default: '',
    },
    interests: {
      type: [String],
      default: [],
    },
    location: {
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },
    profileVisible: {
      type: Boolean,
      default: true,
    },
    stripeCustomerId: {
      type: String,
      select: false,
    },
    subscriptionStatus: {
      type: String,
      enum: ['inactive', 'active', 'cancelled'],
      default: 'inactive',
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare plain password with stored hash
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', UserSchema);
