// Allow-list matching for CORS origins.
//
// Entries come from CORS_ORIGINS (comma-separated) or CLIENT_URL and are
// normalised so a stray space, trailing slash or capital letter in the
// Render dashboard can't silently disable the frontend:
//   " https://App.example.com/ "  ->  "https://app.example.com"
//
// An entry may contain `*` in the host to allow a family of subdomains —
// needed for Vercel preview deployments, whose hostname changes on every
// deploy (enterprise-hrms-<hash>-<team>.vercel.app):
//   https://enterprise-hrms-*-jai-maheshwaris-projects-0934ad9b.vercel.app
// `*` matches one or more of [a-z0-9-] only, never a dot, so it can't be
// widened into "any host". A bare `*` is rejected: this API uses cookies
// and Authorization headers, so reflecting arbitrary origins is never OK.

function normalizeOrigin(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  // Origins are scheme://host[:port] — lower-case is safe for all three.
  return trimmed.toLowerCase();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Turns the raw env string into matchers: exact strings and RegExps.
function parseAllowedOrigins(raw) {
  const matchers = [];
  for (const entry of String(raw || '').split(',')) {
    const origin = normalizeOrigin(entry);
    if (!origin || origin === '*') continue;
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) continue; // not an origin (path, garbage)
    if (origin.includes('*')) {
      const pattern = origin.split('*').map(escapeRegex).join('[a-z0-9-]+');
      matchers.push({ source: origin, regex: new RegExp(`^${pattern}$`) });
    } else {
      matchers.push({ source: origin, exact: origin });
    }
  }
  return matchers;
}

function isOriginAllowed(origin, matchers) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return matchers.some((m) => (m.exact ? m.exact === normalized : m.regex.test(normalized)));
}

module.exports = { normalizeOrigin, parseAllowedOrigins, isOriginAllowed };
