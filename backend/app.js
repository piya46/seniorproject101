require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// --- 🔐 Security Check: Validate Secrets ---
const requiredEnv = ['JWT_SECRET', 'GCP_PROJECT_ID', 'GCS_BUCKET_NAME'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing required secrets: ${missingEnv.join(', ')}`);
  console.error('👉 On Local: Check your .env file');
  console.error('👉 On Cloud Run: Check "Variables & Secrets" mapping from Secret Manager');
  process.exit(1);
}
// ------------------------------------------

// Middlewares
// ✅ FIX: ปรับ CORS ให้ปลอดภัยขึ้นสำหรับ Production
// (ใน Local อาจจะยอมให้ทุก Origin แต่บน Cloud ควรระบุ Domain)
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*', // ควรตั้งค่า FRONTEND_URL ใน Env
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(express.json());

// Import Routes
const sessionRoutes = require('./routes/sessionRoutes');
const metaRoutes = require('./routes/metaRoutes');
const formRoutes = require('./routes/formRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const validationRoutes = require('./routes/validationRoutes');
const documentRoutes = require('./routes/documentRoutes');
const chatRoutes = require('./routes/chatRoutes');

// API Versioning Base URL: /api/v1
const BASE_URL = '/api/v1';

app.use(`${BASE_URL}/session`, sessionRoutes);
app.use(`${BASE_URL}/departments`, metaRoutes);
app.use(`${BASE_URL}/forms`, formRoutes);
app.use(`${BASE_URL}/upload`, uploadRoutes);
app.use(`${BASE_URL}/validation`, validationRoutes);
app.use(`${BASE_URL}/documents`, documentRoutes);
app.use(`${BASE_URL}/chat`, chatRoutes);

// ✅ Add: Global Error Handler (ดัก Error ที่หลุดรอดมา)
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Student Request System API running on port ${PORT}`);
  console.log(`🔒 Security Mode: ${process.env.NODE_ENV === 'production' ? 'Production (Secret Manager)' : 'Development (.env)'}`);
});