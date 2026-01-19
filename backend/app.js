require('dotenv').config();
const express = require('express');
const cors = require('cors');
const securityMiddleware = require('./middlewares/securityMiddleware');
const authRoutes = require('./routes/authRoutes');

// 📄 Swagger Imports
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const app = express();

// --- Security Check ---
const requiredEnv = ['JWT_SECRET', 'GCP_PROJECT_ID', 'GCS_BUCKET_NAME', 'Gb_PRIVATE_KEY_BASE64', 'Gb_PUBLIC_KEY_BASE64'];
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

// รองรับ Payload ขนาดใหญ่ (เพราะ E2EE จะทำให้ string ยาวขึ้น)
app.use(express.json({ limit: '20mb' }));

// -------------------------------------------------------
// 📄 1. SWAGGER SETUP (STATIC MODE)
// วางไว้ *ก่อน* securityMiddleware เพื่อให้เข้าถึงได้โดยไม่ต้องเข้ารหัส
// -------------------------------------------------------
const swaggerFile = path.join(__dirname, 'swagger.json');

if (fs.existsSync(swaggerFile)) {
    const swaggerDocument = require(swaggerFile);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log('📄 Swagger UI available at /api-docs');
} else {
    console.warn('⚠️ Swagger file not found. Please run "npm run docs:build"');
}
// -------------------------------------------------------

// ✅ เปิดใช้งาน Security Middleware (หลังจาก Swagger)
app.use(securityMiddleware);

const BASE_URL = '/api/v1';

// ✅ เพิ่ม Route Auth
app.use(`${BASE_URL}/auth`, authRoutes);
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