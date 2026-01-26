const rateLimit = require('express-rate-limit');

// 1. General Limiter: สำหรับ API ทั่วไป (100 requests / 15 นาที)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later.' }
});

// 2. Strict Limiter: สำหรับ API สำคัญ เช่น สร้าง Session, Upload (20 requests / 15 นาที)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many upload attempts, please slow down.' }
});

module.exports = { generalLimiter, strictLimiter };