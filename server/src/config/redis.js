// Wraps ioredis so the rest of the app can call cache.get/set/del without
// caring whether Redis is actually enabled. When REDIS_ENABLED=false (the
// default for local dev), every method silently no-ops so the app still
// works correctly — just without caching.
const env = require('./env');

let client = null;

function buildNoopClient() {
  return {
    async get() { return null; },
    async set() { return null; },
    async del() { return null; },
    enabled: false,
  };
}

function getRedisClient() {
  if (client) return client;

  if (!env.redis.enabled) {
    client = buildNoopClient();
    return client;
  }

  const Redis = require('ioredis');
  const redis = new Redis(env.redis.url, { lazyConnect: true, maxRetriesPerRequest: 1 });

  redis.on('error', (err) => {
    console.error('[redis] connection error (caching disabled for this request):', err.message);
  });

  redis.connect().then(() => console.log('[redis] connected')).catch(() => {});

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
