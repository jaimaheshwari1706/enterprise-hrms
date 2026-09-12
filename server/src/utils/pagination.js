// Shared helpers so every list endpoint (employees, attendance, leaves,
// payroll, audit logs...) paginates and sorts the exact same way.
//
// Usage inside a controller:
//   const { page, limit, skip } = getPagination(req.query);
//   const sort = getSort(req.query, ['createdAt', 'name'], { createdAt: -1 });
//   const [data, total] = await Promise.all([
//     Model.find(filter).sort(sort).skip(skip).limit(limit),
//     Model.countDocuments(filter),
//   ]);
//   return ok(res, { data, pagination: buildPaginationMeta(page, limit, total) });

const MAX_LIMIT = 100;

function getPagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || 10));
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

// Parses `?sort=field` / `?sort=-field` against a whitelist so clients can
// never sort on an unindexed or private field. Falls back to `defaultSort`.
// A secondary `_id` tie-breaker keeps pagination stable when many rows share
// the same sort value (e.g. the same status or month).
function getSort(query, allowedFields, defaultSort) {
  const raw = typeof query.sort === 'string' ? query.sort.trim() : '';
  if (raw) {
    const desc = raw.startsWith('-');
    const field = desc ? raw.slice(1) : raw;
    if (allowedFields.includes(field)) {
      return { [field]: desc ? -1 : 1, _id: desc ? -1 : 1 };
    }
  }
  return { ...defaultSort, _id: -1 };
}

module.exports = { getPagination, buildPaginationMeta, getSort, MAX_LIMIT };
