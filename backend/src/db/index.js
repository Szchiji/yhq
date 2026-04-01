const mongoose = require('mongoose');
const config = require('../config');

async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
