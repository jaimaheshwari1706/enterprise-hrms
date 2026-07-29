// Shared helper so every list endpoint (employees, attendance, leaves,
// payroll, audit logs...) paginates the exact same way.
//
// Usage inside a controller:
//   const { page, limit, skip } = getPagination(req.query);
//   const [data, total] = await Promise.all([
//     Model.find(filter).skip(skip).limit(limit),
//     Model.countDocuments(filter),
//   ]);
//   return ok(res, { data, pagination: buildPaginationMeta(page, limit, total) });

function getPagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

module.exports = { getPagination, buildPaginationMeta };
