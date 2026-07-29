const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log(`[db] MongoDB connected -> ${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    // Fail fast: an HRMS app is useless without its database.
    process.exit(1);
  }
}

module.exports = connectDB;
