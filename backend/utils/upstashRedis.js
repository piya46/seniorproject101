const crypto = require('crypto');

const DEFAULT_UPSTASH_TIMEOUT_MS = 3000;
const DEFAULT_UPSTASH_KEY_PREFIX = 'ai-formcheck';

const getUpstashRedisRestUrl = () => String(process.env.UPSTASH_REDIS_REST_URL || '').trim();
const getUpstashRedisRestToken = () => String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

const isUpstashRedisConfigured = () =>
    Boolean(getUpstashRedisRestUrl()) && Boolean(getUpstashRedisRestToken());

const getUpstashRedisTimeoutMs = () => {
    const parsed = Number.parseInt(String(process.env.UPSTASH_REDIS_TIMEOUT_MS || DEFAULT_UPSTASH_TIMEOUT_MS), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_UPSTASH_TIMEOUT_MS;
};

const getUpstashRedisKeyPrefix = () =>
    String(process.env.UPSTASH_REDIS_KEY_PREFIX || DEFAULT_UPSTASH_KEY_PREFIX).trim() || DEFAULT_UPSTASH_KEY_PREFIX;

const buildScopedRedisKey = (namespace, rawKey) => {
    const digest = crypto.createHash('sha256').update(String(rawKey || '')).digest('hex');
    return `${getUpstashRedisKeyPrefix()}:${String(namespace || 'default').trim() || 'default'}:${digest}`;
};

const executeUpstashCommand = async (commandParts) => {
    if (!isUpstashRedisConfigured()) {
        throw new Error('Upstash Redis is not configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getUpstashRedisTimeoutMs());

    try {
        const response = await fetch(getUpstashRedisRestUrl(), {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${getUpstashRedisRestToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commandParts),
            signal: controller.signal
        });

        const text = await response.text();
        let payload = null;
        try {
            payload = text ? JSON.parse(text) : null;
        } catch (_error) {
            payload = null;
        }

        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || text || `Upstash request failed with ${response.status}`);
        }

        if (payload?.error) {
            throw new Error(payload.error);
        }

        return payload?.result;
    } finally {
        clearTimeout(timeout);
    }
};

const setWithExpiryIfNotExists = async (namespace, rawKey, value, ttlSeconds) => {
    const redisKey = buildScopedRedisKey(namespace, rawKey);
    const result = await executeUpstashCommand([
        'SET',
        redisKey,
        String(value ?? '1'),
        'EX',
        String(Math.max(1, Math.ceil(Number(ttlSeconds) || 1))),
        'NX'
    ]);

    return result === 'OK';
};

const incrementExpiringCounter = async (namespace, rawKey, windowMs) => {
    const redisKey = buildScopedRedisKey(namespace, rawKey);
    const now = Date.now();
    const normalizedWindowMs = Math.max(1000, Number(windowMs) || 60000);

    const setResult = await executeUpstashCommand([
        'SET',
        redisKey,
        '1',
        'PX',
        String(normalizedWindowMs),
        'NX'
    ]);

    if (setResult === 'OK') {
        return {
            totalHits: 1,
            resetTime: new Date(now + normalizedWindowMs)
        };
    }

    const totalHits = Number(await executeUpstashCommand(['INCR', redisKey]) || 0);
    let ttlMs = Number(await executeUpstashCommand(['PTTL', redisKey]) || -1);

    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
        await executeUpstashCommand(['PEXPIRE', redisKey, String(normalizedWindowMs)]);
        ttlMs = normalizedWindowMs;
    }

    return {
        totalHits,
        resetTime: new Date(now + ttlMs)
    };
};

const decrementCounter = async (namespace, rawKey) => {
    const redisKey = buildScopedRedisKey(namespace, rawKey);
    const currentValue = Number(await executeUpstashCommand(['DECR', redisKey]) || 0);

    if (currentValue <= 0) {
        await executeUpstashCommand(['DEL', redisKey]);
    }
};

const deleteScopedKey = async (namespace, rawKey) => {
    const redisKey = buildScopedRedisKey(namespace, rawKey);
    await executeUpstashCommand(['DEL', redisKey]);
};

module.exports = {
    DEFAULT_UPSTASH_TIMEOUT_MS,
    DEFAULT_UPSTASH_KEY_PREFIX,
    isUpstashRedisConfigured,
    getUpstashRedisTimeoutMs,
    getUpstashRedisKeyPrefix,
    buildScopedRedisKey,
    executeUpstashCommand,
    setWithExpiryIfNotExists,
    incrementExpiringCounter,
    decrementCounter,
    deleteScopedKey
};
