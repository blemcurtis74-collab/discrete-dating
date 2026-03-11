const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/discrete_dating';
  await mongoose.connect(uri);
};

module.exports = connectDB;
