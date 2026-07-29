// Creates a single SUPER_ADMIN login so Phase 3 (auth) can be tested before
// the full demo-data seed script exists (that comes in Phase 12).
//
// Usage: npm run seed:admin
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const { User } = require('../models');
const { hashPassword } = require('../utils/password');

const ADMIN_EMAIL = 'admin@hrms.local';
const ADMIN_PASSWORD = 'Admin@123';

async function run() {
  await mongoose.connect(env.mongoUri);

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`[seed] SUPER_ADMIN already exists: ${ADMIN_EMAIL}`);
  } else {
    await User.create({
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    console.log('[seed] Created SUPER_ADMIN user:');
    console.log(`        email:    ${ADMIN_EMAIL}`);
    console.log(`        password: ${ADMIN_PASSWORD}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
