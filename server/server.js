const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');

async function start() {
  await connectDB();
  const server = app.listen(env.port, () => {
    logger.info('Enterprise HRMS API listening', { port: env.port, env: env.nodeEnv, timezone: env.timezone });
  });

  // Render (and most PaaS) send SIGTERM on every redeploy/restart/scale-down.
  // Without this, in-flight requests get dropped instead of completing.
  let shuttingDown = false;
  function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await mongoose.connection.close();
      logger.info('Closed out remaining connections');
      process.exit(exitCode);
    });
    // Don't hang forever if a connection never drains.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // A rejected promise nobody awaited, or a synchronous throw outside the
  // request cycle, leaves the process in an unknown state. Log with full
  // detail, then let the platform restart us cleanly.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason : new Error(String(reason)) });
    shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err });
    shutdown('uncaughtException', 1);
  });
}

start();
