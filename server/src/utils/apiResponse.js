// Keeps every API response in the same shape:
//   { success, message, data, pagination?, meta? }
// so the frontend never has to guess the response structure. Errors use
//   { success: false, message, code, errors?, requestId? }
// (see middleware/errorHandler.js).

function ok(res, { message = 'Success', data = null, pagination = null, meta = null, statusCode = 200 } = {}) {
  const body = { success: true, message, data };
  if (pagination) body.pagination = pagination;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, { message = 'Created successfully', data = null, meta = null } = {}) {
  return ok(res, { message, data, meta, statusCode: 201 });
}

function fail(res, { message = 'Something went wrong', statusCode = 400, errors = null, code = null } = {}) {
  const body = { success: false, message };
  if (code) body.code = code;
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { ok, created, fail };
