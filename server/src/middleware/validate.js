const ApiError = require('../utils/ApiError');

// Usage:
//   router.post('/', validate(createEmployeeSchema), controller)          // body
//   router.get('/', validate.query(listEmployeesQuery), controller)        // ?query
//   router.get('/:id', validate.params(idParam), controller)              // :params
//
// The Zod schema validates the chosen part of the request and replaces it
// with the parsed (and type-coerced) result, so controllers can trust their
// input: numbers are numbers, enums are valid, ids are well-formed
// ObjectIds, and `?field[$ne]=x` style operator injection is rejected
// because objects don't parse as strings.
function formatIssues(error) {
  return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
}

function buildValidator(source) {
  return function validate(schema) {
    return function runValidation(req, res, next) {
      const result = schema.safeParse(req[source] ?? {});
      if (!result.success) {
        throw new ApiError(422, 'Validation failed', formatIssues(result.error));
      }
      if (source === 'query') {
        // Express 5 makes req.query a getter; Express 4 allows assignment.
        // Mutating in place works for both and keeps the parsed values.
        for (const key of Object.keys(req.query)) delete req.query[key];
        Object.assign(req.query, result.data);
      } else {
        req[source] = result.data;
      }
      next();
    };
  };
}

const validate = buildValidator('body');
validate.body = validate;
validate.query = buildValidator('query');
validate.params = buildValidator('params');

module.exports = validate;
