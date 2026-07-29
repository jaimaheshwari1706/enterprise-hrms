const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[server] Enterprise HRMS API listening on http://localhost:${env.port}`);
  });
}

start();
