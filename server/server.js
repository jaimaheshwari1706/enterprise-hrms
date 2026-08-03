const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

async function start() {
  await connectDB();
  const server = app.listen(env.port, () => {
    console.log(`[server] Enterprise HRMS API listening on http://localhost:${env.port}`);
  });

  // Render (and most PaaS) send SIGTERM on every redeploy/restart/scale-down.
  // Without this, in-flight requests get dropped instead of completing.
  function shutdown(signal) {
    console.log(`[server] ${signal} received, shutting down gracefully`);
    server.close(async () => {
      await mongoose.connection.close();
      console.log('[server] closed out remaining connections');
      process.exit(0);
    });
    // Don't hang forever if a connection never drains.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
