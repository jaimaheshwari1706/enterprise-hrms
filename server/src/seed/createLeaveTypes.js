// Seeds the three default leave types so Phase 7 can be tested before the
// full demo-data seed script exists (that comes in Phase 12).
//
// Usage: npm run seed:leave-types
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const { LeaveType } = require('../models');

const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', defaultDaysPerYear: 12, description: 'For short personal needs' },
  { name: 'Sick Leave', defaultDaysPerYear: 10, description: 'For illness or medical needs' },
  { name: 'Paid Leave', defaultDaysPerYear: 15, description: 'Planned time off, deducted from annual allowance' },
];

async function run() {
  await mongoose.connect(env.mongoUri);

  for (const type of DEFAULT_LEAVE_TYPES) {
    const existing = await LeaveType.findOne({ name: type.name });
    if (existing) {
      console.log(`[seed] Leave type already exists: ${type.name}`);
    } else {
      await LeaveType.create(type);
      console.log(`[seed] Created leave type: ${type.name}`);
    }
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
