const Redis = require('ioredis');

let sharedRedisClient = null;

const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const buildRedisClient = () => {
  const redisUrl = String(process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL || '').trim();

  if (redisUrl) {
    return new Redis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
  }

  const host = String(process.env.RATE_LIMIT_REDIS_HOST || process.env.REDIS_HOST || '').trim();
  if (!host) {
    throw new Error('RATE_LIMIT_REDIS_URL or RATE_LIMIT_REDIS_HOST is required when RATE_LIMIT_STORE_PROVIDER=redis.');
  }

  const port = Number.parseInt(String(process.env.RATE_LIMIT_REDIS_PORT || process.env.REDIS_PORT || '6379'), 10);
  const username = String(process.env.RATE_LIMIT_REDIS_USERNAME || process.env.REDIS_USERNAME || '').trim() || undefined;
  const password = String(process.env.RATE_LIMIT_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '').trim() || undefined;
  const useTls = isTruthy(process.env.RATE_LIMIT_REDIS_TLS || process.env.REDIS_TLS);

  return new Redis({
    host,
    port: Number.isFinite(port) && port > 0 ? port : 6379,
    username,
    password,
    tls: useTls ? {} : undefined,
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
};

const getSharedRedisClient = () => {
  if (!sharedRedisClient) {
    sharedRedisClient = buildRedisClient();
  }

  return sharedRedisClient;
};

class RedisRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.localKeys = false;
    this.windowMs = 60 * 1000;
    this.redis = getSharedRedisClient();
    this.keyPrefix = String(process.env.RATE_LIMIT_REDIS_KEY_PREFIX || 'rate-limit:').trim() || 'rate-limit:';
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  getRedisKey(key) {
    return `${this.keyPrefix}${this.prefix}:${key}`;
  }

  async increment(key) {
    const redisKey = this.getRedisKey(key);
    const now = Date.now();
    const results = await this.redis
      .multi()
      .incr(redisKey)
      .pexpire(redisKey, this.windowMs, 'NX')
      .pttl(redisKey)
      .exec();

    const totalHits = Number(results?.[0]?.[1] || 1);
    const ttlMs = Number(results?.[2]?.[1] || this.windowMs);
    const effectiveTtlMs = ttlMs > 0 ? ttlMs : this.windowMs;

    return {
      totalHits,
      resetTime: new Date(now + effectiveTtlMs)
    };
  }

  async decrement(key) {
    const redisKey = this.getRedisKey(key);
    const totalHits = Number(await this.redis.decr(redisKey));

    if (!Number.isFinite(totalHits) || totalHits <= 0) {
      await this.redis.del(redisKey);
    }
  }

  async resetKey(key) {
    await this.redis.del(this.getRedisKey(key));
  }
}

const createRedisRateLimitStore = (prefix) => new RedisRateLimitStore(prefix);

module.exports = {
  RedisRateLimitStore,
  createRedisRateLimitStore,
  getSharedRedisClient
};
