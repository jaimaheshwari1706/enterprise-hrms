// User-supplied search terms must never be compiled into a RegExp as-is:
// "(a+)+$" can pin the event loop (ReDoS) and ".*" matches everything.
const MAX_SEARCH_LENGTH = 100;

function escapeRegex(value = '') {
  return String(value)
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-insensitive "contains" matcher safe for use in Mongo filters.
function containsRegex(value) {
  return new RegExp(escapeRegex(String(value).trim()), 'i');
}

module.exports = { escapeRegex, containsRegex, MAX_SEARCH_LENGTH };
