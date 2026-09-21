// CORS regression tests. The production symptom these guard against:
//   OPTIONS /auth/login  →  404 "Route not found: OPTIONS /auth/login", no
//   Access-Control-Allow-Origin header
// which is what the `cors` package produces when the Origin is not in the
// allow-list (it calls next() with no headers and the request falls into
// the JSON 404). No database is needed: preflights never reach a route.
const request = require('supertest');
const env = require('../../src/config/env');
const { parseAllowedOrigins, normalizeOrigin, isOriginAllowed } = require('../../src/utils/corsOrigins');
const app = require('../../src/app');

const VERCEL = 'https://enterprise-hrms-2iq645v3l-jai-maheshwaris-projects-0934ad9b.vercel.app';
const VERCEL_PREVIEW_PATTERN = 'https://enterprise-hrms-*-jai-maheshwaris-projects-0934ad9b.vercel.app';
const LOCALHOST = 'http://localhost:5173';

const originalOrigins = env.corsOrigins;
function allow(raw) {
  env.corsOrigins = parseAllowedOrigins(raw);
}
afterEach(() => {
  env.corsOrigins = originalOrigins;
});

const preflight = (path, origin, extra = {}) =>
  request(app)
    .options(path)
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'content-type, authorization')
    .set(extra);

describe('Origin allow-list parsing', () => {
  it('trims whitespace, strips trailing slashes, lower-cases and drops empty entries', () => {
    const m = parseAllowedOrigins(` ${VERCEL}/ , ,HTTP://Localhost:5173/,,`);
    expect(m.map((x) => x.exact)).toEqual([VERCEL, LOCALHOST]);
    expect(normalizeOrigin(' https://A.b/ ')).toBe('https://a.b');
  });

  it('rejects a bare "*" and non-origin garbage', () => {
    expect(parseAllowedOrigins('*, https://ok.example.com, not-an-origin, https://x.com/path')).toHaveLength(1);
  });

  it('supports a host wildcard for Vercel preview deployments, but never across dots', () => {
    const m = parseAllowedOrigins(VERCEL_PREVIEW_PATTERN);
    expect(isOriginAllowed(VERCEL, m)).toBe(true);
    expect(isOriginAllowed('https://enterprise-hrms-abc123-jai-maheshwaris-projects-0934ad9b.vercel.app', m)).toBe(true);
    expect(isOriginAllowed('https://enterprise-hrms-x.evil.com-jai-maheshwaris-projects-0934ad9b.vercel.app', m)).toBe(false);
    expect(isOriginAllowed('https://evil.com', m)).toBe(false);
    expect(isOriginAllowed('https://enterprise-hrms--jai-maheshwaris-projects-0934ad9b.vercel.app', m)).toBe(false); // `*` needs ≥1 char
  });
});

describe('Preflight from the allowed Vercel origin', () => {
  beforeEach(() => allow(`${VERCEL},${LOCALHOST}`));

  it('OPTIONS /auth/login (the exact production probe) succeeds with the right headers', async () => {
    const res = await preflight('/auth/login', VERCEL);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toMatch(/\bPOST\b/);
    expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
    expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(res.headers['access-control-max-age']).toBe('600');
    expect(res.headers.vary).toMatch(/Origin/);
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('OPTIONS /api/auth/login (the real route) succeeds too', async () => {
    const res = await preflight('/api/auth/login', VERCEL);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
  });

  it('accepts the origin even when the dashboard value had a trailing slash / different case', async () => {
    allow(`${VERCEL.toUpperCase()}/`);
    const res = await preflight('/auth/login', VERCEL);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
  });

  it('matches a Vercel preview hostname through the documented wildcard entry', async () => {
    allow(VERCEL_PREVIEW_PATTERN);
    const res = await preflight('/auth/login', VERCEL);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
  });

  it('actual (non-preflight) responses carry the origin and credentials headers', async () => {
    const res = await request(app).post('/api/auth/login').set('Origin', VERCEL).send({});
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toMatch(/X-Request-Id/);
    expect(res.status).toBe(422); // validation ran — CORS did not block or short-circuit
  });

  it('does not require authentication for a preflight on a protected route', async () => {
    const res = await preflight('/api/profile/me', VERCEL);
    expect(res.status).toBe(204);
  });
});

describe('Disallowed origins', () => {
  beforeEach(() => allow(`${VERCEL},${LOCALHOST}`));

  it('rejects an arbitrary origin\'s preflight with 403 and no Access-Control-Allow-Origin', async () => {
    const res = await preflight('/auth/login', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CORS_ORIGIN_DENIED');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('never reflects an unknown origin on actual requests either', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200); // server-to-server style access is not CORS's job to block…
    expect(res.headers['access-control-allow-origin']).toBeUndefined(); // …but the browser will refuse it
  });

  it('a preflight for an unknown route from an unknown origin is still denied, not routed', async () => {
    const res = await preflight('/api/does-not-exist', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('a lookalike of the Vercel origin is rejected', async () => {
    const res = await preflight('/auth/login', `${VERCEL}.evil.com`);
    expect(res.status).toBe(403);
  });
});

describe('Unknown routes keep the JSON 404', () => {
  beforeEach(() => allow(`${VERCEL},${LOCALHOST}`));

  it('GET of an unknown route returns the normal JSON 404 (with CORS headers for an allowed origin)', async () => {
    const res = await request(app).get('/auth/login').set('Origin', VERCEL);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND', message: 'Route not found: GET /auth/login' });
    expect(res.headers['access-control-allow-origin']).toBe(VERCEL);
  });

  it('OPTIONS without an Origin header (not a CORS preflight) still gets the JSON 404 for unknown routes', async () => {
    const res = await request(app).options('/auth/login');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('Local development', () => {
  it('localhost:5173 keeps working with the default configuration', async () => {
    allow(''); // parseAllowedOrigins('') → [], mimic default resolution used by env.js
    env.corsOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173');
    const res = await preflight('/api/auth/login', LOCALHOST);
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(LOCALHOST);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('127.0.0.1 is not implicitly the same as localhost (must be listed to be allowed)', async () => {
    allow(LOCALHOST);
    expect((await preflight('/api/auth/login', 'http://127.0.0.1:5173')).status).toBe(403);
    allow(`${LOCALHOST},http://127.0.0.1:5173`);
    expect((await preflight('/api/auth/login', 'http://127.0.0.1:5173')).status).toBe(204);
  });
});
