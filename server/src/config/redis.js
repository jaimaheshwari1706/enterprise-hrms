// Wraps ioredis so the rest of the app can call cache.get/set/del without
// caring whether Redis is actually enabled. When REDIS_ENABLED=false (the
// default for local dev), every method silently no-ops so the app still
// works correctly — just without caching (and with per-process rate
// limiting, see middleware/rateLimiter).
const env = require('./env');
const logger = require('../utils/logger');

let client = null;
let rawClient = null;

function buildNoopClient() {
  return {
    async get() { return null; },
    async set() { return null; },
    async del() { return null; },
    enabled: false,
  };
}

// The underlying ioredis connection (or null when Redis is disabled), for
// code that needs commands beyond the cache API — the rate-limit store.
function getRawRedis() {
  if (!env.redis.enabled) return null;
  if (rawClient) return rawClient;

  const Redis = require('ioredis');
  rawClient = new Redis(env.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    // Don't queue commands while disconnected: callers get an immediate
    // error and fall back (cache miss / rate-limit fail-open) instead of
    // hanging requests until the connection comes back.
    enableOfflineQueue: false,
  });

  rawClient.on('error', (err) => {
    logger.error('Redis connection error (caching/rate-limit degraded for this request)', { error: err });
  });
  rawClient.on('ready', () => logger.info('Redis connected'));
  rawClient.connect().catch(() => {});
  return rawClient;
}

function getRedisClient() {
  if (client) return client;

  if (!env.redis.enabled) {
    client = buildNoopClient();
    return client;
  }

  const redis = getRawRedis();

  client = {
    enabled: true,
    async get(key) {
      try {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : null;
      } catch {
        return null;
      }
    },
    async set(key, value, ttlSeconds = 300) {
      try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch {
        /* cache write failures should never break the request */
      }
    },
    async del(key) {
      try {
        await redis.del(key);
      } catch {
        /* ignore */
      }
    },
  };

  return client;
}

module.exports = getRedisClient;
module.exports.getRawRedis = getRawRedis;
