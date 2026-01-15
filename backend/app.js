// backend/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const securityMiddleware = require('./middlewares/securityMiddleware'); // ✅ เพิ่ม
const authRoutes = require('./routes/authRoutes'); // ✅ เพิ่ม

const app = express();

// --- Security Check ---
const requiredEnv = ['JWT_SECRET', 'GCP_PROJECT_ID', 'GCS_BUCKET_NAME', 'Gb_PRIVATE_KEY_BASE64', 'Gb_PUBLIC_KEY_BASE64']; // ✅ เพิ่ม Key เข้าไปใน Check list
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing secrets: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// Config CORS
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// ✅ เพิ่ม limit รองรับ Payload ที่เข้ารหัสแล้วขนาดจะใหญ่ขึ้น
app.use(express.json({ limit: '20mb' }));

// ✅ เปิดใช้งาน Security Middleware (ก่อน Route ทั้งหมด)
app.use(securityMiddleware);

const BASE_URL = '/api/v1';

// ✅ เพิ่ม Route Auth
app.use(`${BASE_URL}/auth`, authRoutes);

// Routes เดิม
app.use(`${BASE_URL}/session`, require('./routes/sessionRoutes'));
app.use(`${BASE_URL}/departments`, require('./routes/metaRoutes'));
app.use(`${BASE_URL}/forms`, require('./routes/formRoutes'));
app.use(`${BASE_URL}/upload`, require('./routes/uploadRoutes'));
app.use(`${BASE_URL}/validation`, require('./routes/validationRoutes'));
app.use(`${BASE_URL}/documents`, require('./routes/documentRoutes'));
app.use(`${BASE_URL}/chat`, require('./routes/chatRoutes'));

// Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`🔒 E2EE Security: ACTIVE`);
});