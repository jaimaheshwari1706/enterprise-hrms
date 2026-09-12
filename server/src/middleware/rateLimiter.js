const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { getRawRedis } = require('../config/redis');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Store
//
// express-rate-limit's default MemoryStore counts per *process*. That is
// correct on a single Render instance, but with N instances behind a load
// balancer each client effectively gets N × the limit (and a restart resets
// every counter). When Redis is enabled the counters live there instead,
// shared by every instance. When it is disabled (local dev, tests, a
// single-instance deployment) the memory store is used unchanged.
//
// Failure mode: if Redis is unreachable at request time the limiter fails
// *open* (passOnStoreError) and logs — a Redis blip must never take the
// whole API down. Brute-force protection then relies on the per-account
// lockout in auth.controller, which is Mongo-backed and unaffected.
// ---------------------------------------------------------------------------
class RedisStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.localKeys = false;
    this.windowMs = 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  key(key) {
    return `${this.prefix}${key}`;
  }

  // INCR + set the window TTL only on the first hit, atomically (MULTI), so
  // the window is fixed from the first request rather than sliding.
  async increment(key) {
    const redis = getRawRedis();
    const results = await redis.multi().incr(this.key(key)).pttl(this.key(key)).exec();
    const totalHits = results[0][1];
    let ttl = results[1][1];
    if (ttl < 0) {
      await redis.pexpire(this.key(key), this.windowMs);
      ttl = this.windowMs;
    }
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }

  async decrement(key) {
    await getRawRedis().decr(this.key(key));
  }

  async resetKey(key) {
    await getRawRedis().del(this.key(key));
  }
}

function storeFor(name) {
  if (!env.redis.enabled) return {};
  logger.info(`Rate limiter "${name}" using shared Redis store`);
  return { store: new RedisStore(`rl:${name}:`), passOnStoreError: true };
}

const limitedResponse = (message) => ({
  success: false,
  code: 'RATE_LIMITED',
  message,
});

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  // Integration tests fire hundreds of requests from one address; the
  // limiters themselves are library behaviour, so they're bypassed there.
  skip: () => env.nodeEnv === 'test',
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.originalUrl, requestId: req.id });
    res.status(options.statusCode).json(options.message);
  },
};

// Login / forgot-password / reset-password: slows credential stuffing and
// reset-token guessing from a single IP. Per-account lockout (see
// auth.controller) covers the distributed case.
const authLimiter = rateLimit({
  ...common,
  ...storeFor('auth'),
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: limitedResponse('Too many attempts. Please try again in a few minutes.'),
});

// Refresh is called on every page load and every ~15 min per tab; 60 per
// 15 min per IP is far above legitimate use but stops a stolen-cookie
// replay loop from hammering the token table.
const refreshLimiter = rateLimit({
  ...common,
  ...storeFor('refresh'),
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: limitedResponse('Too many session refresh attempts. Please sign in again.'),
});

// Global safety net for everything under /api. Generous enough that an
// office behind a single NAT address with the notification poller (2/min
// per tab) never hits it, but a runaway script does.
const apiLimiter = rateLimit({
  ...common,
  ...storeFor('api'),
  windowMs: 15 * 60 * 1000,
  max: 1500,
  message: limitedResponse('Too many requests. Please slow down and try again shortly.'),
  skip: (req) => env.nodeEnv === 'test' || req.path === '/health' || req.path === '/ready',
});

module.exports = { authLimiter, refreshLimiter, apiLimiter, RedisStore };
