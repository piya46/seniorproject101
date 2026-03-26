const { createFirestoreRateLimitStore } = require('./firestoreRateLimitStore');
const { createRedisRateLimitStore } = require('./redisRateLimitStore');

const SUPPORTED_PROVIDERS = new Set(['firestore', 'redis']);

const getRateLimitStoreProvider = () => {
  const provider = String(process.env.RATE_LIMIT_STORE_PROVIDER || 'firestore').trim().toLowerCase();
  return SUPPORTED_PROVIDERS.has(provider) ? provider : 'firestore';
};

const createRateLimitStore = (prefix) => {
  const provider = getRateLimitStoreProvider();

  if (provider === 'redis') {
    return createRedisRateLimitStore(prefix);
  }

  return createFirestoreRateLimitStore(prefix);
};

module.exports = {
  SUPPORTED_PROVIDERS,
  createRateLimitStore,
  getRateLimitStoreProvider
};
