const rateLimit = require('express-rate-limit');
const { createFirestoreRateLimitStore } = require('../utils/firestoreRateLimitStore');

// 1. General Limiter: สำหรับ API ทั่วไป (100 requests / 15 นาที)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    store: createFirestoreRateLimitStore('general'),
    standardHeaders: true, 
    legacyHeaders: false,
    passOnStoreError: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});

// 2. Strict Limiter: สำหรับ API สำคัญ เช่น สร้าง Session, Upload (20 requests / 15 นาที)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    store: createFirestoreRateLimitStore('strict'),
    standardHeaders: true, 
    legacyHeaders: false,
    passOnStoreError: false,
    keyGenerator: (req) => {
        const sessionId = req.user?.session_id;
        const email = req.user?.email;
        if (sessionId) {
            return `session:${sessionId}`;
        }
        if (email) {
            return `email:${String(email).trim().toLowerCase()}`;
        }
        return `ip:${req.ip}`;
    },
    message: { status: 'error', message: 'Too many upload attempts, please slow down.' }
});

const createScopedLimiter = (prefix, options = {}) => rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max ?? 10,
    store: createFirestoreRateLimitStore(prefix),
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: false,
    message: options.message ?? { status: 'error', message: 'Too many requests, please try again later.' }
});

module.exports = { generalLimiter, strictLimiter, createScopedLimiter };
