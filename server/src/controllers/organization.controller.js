const { Organization } = require('../models');
const { uploadBufferToCloudinary } = require('../middleware/upload');
const getRedisClient = require('../config/redis');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const ApiError = require('../utils/ApiError');

const ORG_CACHE_KEY = 'organization:info';
const ORG_CACHE_TTL_SECONDS = 300;

// A single-tenant app only ever has one Organization document. This helper
// fetches it, creating a bare default one on first run so GET never 404s.
async function getOrCreateOrganization() {
  let org = await Organization.findOne();
  if (!org) {
    org = await Organization.create({ name: 'My Organization' });
  }
  return org;
}

// GET /api/organization
const getOrganization = asyncHandler(async (req, res) => {
  const cache = getRedisClient();
  const cached = await cache.get(ORG_CACHE_KEY);
  if (cached) {
    return ok(res, { message: 'Organization details (cached)', data: cached });
  }

  const org = await getOrCreateOrganization();
  await cache.set(ORG_CACHE_KEY, org, ORG_CACHE_TTL_SECONDS);
  return ok(res, { message: 'Organization details', data: org });
});

// PUT /api/organization  (HR_ADMIN, SUPER_ADMIN) — settings only, no file.
// Logo upload is a separate endpoint (POST /api/organization/logo) so this
// stays a simple JSON request that Zod can validate cleanly.
const updateOrganization = asyncHandler(async (req, res) => {
  const org = await getOrCreateOrganization();
  Object.assign(org, req.body);
  await org.save();

  await logAction({
    user: req.user,
    action: 'UPDATE_ORGANIZATION',
    entityType: 'Organization',
    entityId: org._id,
    description: 'Updated organization settings',
    ip: req.ip,
  });

  await getRedisClient().del(ORG_CACHE_KEY);
  return ok(res, { message: 'Organization updated successfully', data: org });
});

// POST /api/organization/logo  (HR_ADMIN, SUPER_ADMIN) — multipart upload.
const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded. Attach an image under the "logo" field.');
  }

  const org = await getOrCreateOrganization();

  const result = await uploadBufferToCloudinary(req.file.buffer, 'hrms/organization');
  org.logoUrl = result.secure_url;
  await org.save();

  await logAction({
    user: req.user,
    action: 'UPDATE_ORGANIZATION',
    entityType: 'Organization',
    entityId: org._id,
    description: 'Updated organization logo',
    ip: req.ip,
  });

  await getRedisClient().del(ORG_CACHE_KEY);
  return ok(res, { message: 'Logo uploaded successfully', data: org });
});

module.exports = { getOrganization, updateOrganization, uploadLogo };
