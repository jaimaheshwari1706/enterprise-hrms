const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDB() {
  // Log state changes so a flapping Atlas connection is visible in the
  // Render logs instead of surfacing only as random 500s.
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', { error: err }));

  try {
    await mongoose.connect(env.mongoUri, {
      // Fail fast on a bad URI / unreachable cluster instead of hanging
      // for the driver's 30s default while Render waits on the health check.
      serverSelectionTimeoutMS: 10000,
      // Mongoose builds any missing indexes declared on the schemas at
      // startup (autoIndex). Atlas builds them in the background, so this
      // is safe for the collection sizes an HRMS deals with.
    });
    logger.info('MongoDB connected', { database: mongoose.connection.name });
  } catch (err) {
    logger.error('MongoDB connection failed', { error: err });
    // Fail fast: an HRMS app is useless without its database.
    process.exit(1);
  }
}

module.exports = connectDB;
