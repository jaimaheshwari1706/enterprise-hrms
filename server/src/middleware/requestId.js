const crypto = require('crypto');

// Tags every request with a short id that is echoed in error responses and
// server logs, so a user-reported "requestId: abc123" can be matched to the
// exact log line. Honours an inbound X-Request-Id from a trusted proxy.
function requestId(req, res, next) {
  const inbound = req.headers['x-request-id'];
  req.id = typeof inbound === 'string' && /^[\w.-]{8,64}$/.test(inbound) ? inbound : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
