const ApiError = require('../utils/ApiError');

// Usage: router.post('/', validate(createEmployeeSchema), controller)
// The Zod schema validates req.body and replaces it with the parsed
// (and type-coerced) result, so controllers can trust their input.
function validate(schema) {
  return function runValidation(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new ApiError(422, 'Validation failed', errors);
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
