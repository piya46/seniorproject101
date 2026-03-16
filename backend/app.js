require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet'); 
const securityMiddleware = require('./middlewares/securityMiddleware');
const authRoutes = require('./routes/authRoutes');
const iapMiddleware = require('./middlewares/iapMiddleware');
const { generalLimiter } = require('./middlewares/rateLimitMiddleware');

// Swagger Imports
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const app = express();
const iapEnabled = String(process.env.IAP_ENABLED || '').toLowerCase() === 'true';

// --- Security Check ---
const requiredEnv = ['JWT_SECRET', 'GCP_PROJECT_ID', 'GCS_BUCKET_NAME', 'Gb_PRIVATE_KEY_BASE64', 'Gb_PUBLIC_KEY_BASE64'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing secrets: ${missingEnv.join(', ')}`);
  process.exit(1);
}

app.set('trust proxy', 1);

// ✅ SECURITY UPGRADE: Helmet with strict CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], 
            scriptSrc: ["'self'"], // ห้ามรัน Inline Script
            objectSrc: ["'none'"], // ปิดช่องโหว่ Flash/Plugin
            upgradeInsecureRequests: [], // บังคับใช้ HTTPS
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS Setup
const rawOrigins = process.env.FRONTEND_URL || "http://localhost:3000|http://localhost:5500|http://127.0.0.1:5500";
const allowedOrigins = rawOrigins.split(/[,|]/).map(url => url.trim());

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⛔ Blocked CORS for: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true 
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser()); 
app.use(generalLimiter);

app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Swagger Setup
const swaggerFile = path.join(__dirname, 'swagger.json');
if (process.env.NODE_ENV === 'development' && fs.existsSync(swaggerFile)) {
    const swaggerDocument = require(swaggerFile);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Security Middleware (Encryption/Decryption)
app.use(securityMiddleware);

const BASE_URL = '/api/v1';

app.use(`${BASE_URL}/auth`, authRoutes);
app.use(BASE_URL, iapMiddleware);
app.use(`${BASE_URL}/session`, require('./routes/sessionRoutes'));
app.use(`${BASE_URL}/departments`, require('./routes/metaRoutes'));
app.use(`${BASE_URL}/forms`, require('./routes/formRoutes'));
app.use(`${BASE_URL}/upload`, require('./routes/uploadRoutes'));
app.use(`${BASE_URL}/validation`, require('./routes/validationRoutes'));
app.use(`${BASE_URL}/documents`, require('./routes/documentRoutes'));
app.use(`${BASE_URL}/chat`, require('./routes/chatRoutes'));
app.use(`${BASE_URL}/support`, require('./routes/supportRoutes'));

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
  console.log(`🌍 Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`🔒 E2EE Security: ACTIVE`);
  console.log(`🪪 IAP Enforcement: ${iapEnabled ? 'ENABLED' : 'DISABLED'}`);
});
