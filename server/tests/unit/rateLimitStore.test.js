// The Redis-backed rate-limit store, exercised against an in-memory fake of
// the three ioredis commands it uses (INCR / PTTL via MULTI, PEXPIRE, DECR,
// DEL) so the window semantics are verified without a Redis server.
jest.mock('../../src/config/redis', () => {
  const state = new Map(); // key -> { value, expiresAt }
  const now = () => Date.now();
  const live = (key) => {
    const entry = state.get(key);
    if (entry && entry.expiresAt && entry.expiresAt <= now()) state.delete(key);
    return state.get(key);
  };
  const fake = {
    async incr(key) {
      const entry = live(key) || { value: 0, expiresAt: null };
      entry.value += 1;
      state.set(key, entry);
      return entry.value;
    },
    async pttl(key) {
      const entry = live(key);
      if (!entry) return -2;
      return entry.expiresAt ? Math.max(0, entry.expiresAt - now()) : -1;
    },
    async pexpire(key, ms) {
      const entry = live(key);
      if (entry) entry.expiresAt = now() + ms;
      return entry ? 1 : 0;
    },
    async decr(key) {
      const entry = live(key);
      if (entry) entry.value -= 1;
      return entry ? entry.value : -1;
    },
    async del(key) {
      return state.delete(key) ? 1 : 0;
    },
    multi() {
      const ops = [];
      const chain = {
        incr: (k) => (ops.push(() => fake.incr(k)), chain),
        pttl: (k) => (ops.push(() => fake.pttl(k)), chain),
        exec: async () => Promise.all(ops.map(async (op) => [null, await op()])),
      };
      return chain;
    },
    __state: state,
  };
  const getRedisClient = () => ({ enabled: true, get: async () => null, set: async () => null, del: async () => null });
  getRedisClient.getRawRedis = () => fake;
  return getRedisClient;
});

const { RedisStore } = require('../../src/middleware/rateLimiter');
const { getRawRedis } = require('../../src/config/redis');

describe('RedisStore (shared rate-limit counters)', () => {
  let store;

  beforeEach(() => {
    getRawRedis().__state.clear();
    store = new RedisStore('rl:test:');
    store.init({ windowMs: 1000 });
  });

  it('is marked as a shared (non-local) store with a key prefix', () => {
    expect(store.localKeys).toBe(false);
    expect(store.prefix).toBe('rl:test:');
  });

  it('counts hits per key and starts the window on the first hit', async () => {
    const first = await store.increment('1.2.3.4');
    expect(first.totalHits).toBe(1);
    expect(first.resetTime.getTime()).toBeGreaterThan(Date.now());
    expect(first.resetTime.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    const second = await store.increment('1.2.3.4');
    expect(second.totalHits).toBe(2);
    // The window is fixed from the first hit — the reset time does not move.
    expect(Math.abs(second.resetTime - first.resetTime)).toBeLessThan(50);
  });

  it('keeps separate counters per client key', async () => {
    await store.increment('a');
    await store.increment('a');
    const b = await store.increment('b');
    expect(b.totalHits).toBe(1);
  });

  it('decrement and resetKey adjust the shared counter', async () => {
    await store.increment('a');
    await store.increment('a');
    await store.decrement('a');
    expect((await store.increment('a')).totalHits).toBe(2);
    await store.resetKey('a');
    expect((await store.increment('a')).totalHits).toBe(1);
  });

  it('starts a fresh window once the previous one expires', async () => {
    store.init({ windowMs: 20 });
    await store.increment('a');
    await new Promise((r) => setTimeout(r, 30));
    expect((await store.increment('a')).totalHits).toBe(1);
  });

  it('propagates Redis errors so express-rate-limit can fail open (passOnStoreError)', async () => {
    const redis = getRawRedis();
    const original = redis.multi;
    redis.multi = () => ({ incr() { return this; }, pttl() { return this; }, exec: async () => { throw new Error('ECONNREFUSED'); } });
    await expect(store.increment('a')).rejects.toThrow('ECONNREFUSED');
    redis.multi = original;
  });
});
