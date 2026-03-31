const { firestore } = require('./dbUtils');
const {
    decrementCounter,
    deleteScopedKey,
    incrementExpiringCounter,
    isUpstashRedisConfigured
} = require('./upstashRedis');

const COLLECTION_NAME = 'RATE_LIMITS';

class FirestoreRateLimitStore {
    constructor(prefix) {
        this.prefix = prefix;
        this.localKeys = false;
        this.windowMs = 60 * 1000;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    getDocRef(key) {
        return firestore.collection(COLLECTION_NAME).doc(`${this.prefix}:${key}`);
    }

    async increment(key) {
        const docRef = this.getDocRef(key);
        const now = Date.now();
        const nextResetTime = new Date(now + this.windowMs);

        return firestore.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(docRef);
            let totalHits = 1;
            let resetTime = nextResetTime;

            if (snapshot.exists) {
                const data = snapshot.data() || {};
                const existingResetTime = data.resetTime?.toDate?.() || new Date(data.resetTime || 0);
                const existingHits = Number(data.totalHits) || 0;

                if (existingResetTime.getTime() > now) {
                    totalHits = existingHits + 1;
                    resetTime = existingResetTime;
                }
            }

            transaction.set(docRef, {
                totalHits,
                resetTime,
                expireAt: resetTime,
                updatedAt: new Date(now)
            });

            return { totalHits, resetTime };
        });
    }

    async decrement(key) {
        const docRef = this.getDocRef(key);
        const now = Date.now();

        await firestore.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(docRef);
            if (!snapshot.exists) {
                return;
            }

            const data = snapshot.data() || {};
            const existingResetTime = data.resetTime?.toDate?.() || new Date(data.resetTime || 0);
            const existingHits = Number(data.totalHits) || 0;

            if (existingResetTime.getTime() <= now || existingHits <= 1) {
                transaction.delete(docRef);
                return;
            }

            transaction.update(docRef, {
                totalHits: existingHits - 1,
                updatedAt: new Date(now)
            });
        });
    }

    async resetKey(key) {
        await this.getDocRef(key).delete().catch(() => {});
    }
}

class UpstashRateLimitStore {
    constructor(prefix) {
        this.prefix = prefix;
        this.localKeys = false;
        this.windowMs = 60 * 1000;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
        return incrementExpiringCounter(`rate-limit:${this.prefix}`, key, this.windowMs);
    }

    async decrement(key) {
        await decrementCounter(`rate-limit:${this.prefix}`, key);
    }

    async resetKey(key) {
        await deleteScopedKey(`rate-limit:${this.prefix}`, key);
    }
}

const createFirestoreRateLimitStore = (prefix) => new FirestoreRateLimitStore(prefix);
const createRateLimitStore = (prefix) =>
    isUpstashRedisConfigured() ? new UpstashRateLimitStore(prefix) : new FirestoreRateLimitStore(prefix);

module.exports = {
    FirestoreRateLimitStore,
    UpstashRateLimitStore,
    createFirestoreRateLimitStore,
    createRateLimitStore
};
