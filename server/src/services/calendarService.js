// Loads the organization's working calendar (working weekdays + holidays)
// for use by leave, attendance, dashboard and payroll code. The
// organization document is tiny and changes rarely, so it is memoised in
// process for a short time and invalidated whenever the organization is
// updated (see organization.controller).
const { Organization } = require('../models');
const { buildCalendar } = require('../utils/workingDays');

const CACHE_TTL_MS = 60 * 1000;

let cached = null; // { calendar, org, expiresAt }

async function loadOrganization() {
  return Organization.findOne().lean();
}

// Returns { calendar, payrollPolicy } — `calendar` is the structure
// accepted by every helper in utils/workingDays.
async function getWorkingCalendar() {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const org = (await loadOrganization()) || {};
  const value = {
    calendar: buildCalendar(org),
    payrollPolicy: {
      proRataBasis: org.payrollPolicy?.proRataBasis || 'none',
      deductUnpaidLeave: Boolean(org.payrollPolicy?.deductUnpaidLeave),
    },
    timezone: org.timezone || null,
  };
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

function invalidateWorkingCalendar() {
  cached = null;
}

module.exports = { getWorkingCalendar, invalidateWorkingCalendar };
