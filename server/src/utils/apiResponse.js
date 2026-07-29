// Keeps every API response in the same shape:
// { success, message, data, pagination? }
// so the frontend never has to guess the response structure.

function ok(res, { message = 'Success', data = null, pagination = null, statusCode = 200 } = {}) {
  const body = { success: true, message, data };
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
}

function created(res, { message = 'Created successfully', data = null } = {}) {
  return ok(res, { message, data, statusCode: 201 });
}

function fail(res, { message = 'Something went wrong', statusCode = 400, errors = null } = {}) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { ok, created, fail };
