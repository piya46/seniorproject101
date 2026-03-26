require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet'); 
const securityMiddleware = require('./middlewares/securityMiddleware');
const authRoutes = require('./routes/authRoutes');
const oidcAuthRoutes = require('./routes/oidcAuthRoutes');
const { generalLimiter } = require('./middlewares/rateLimitMiddleware');
const { getKeyStatus } = require('./utils/cryptoUtils');

// Swagger Imports
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const app = express();
const oidcEnabled = String(process.env.OIDC_ENABLED !== undefined ? process.env.OIDC_ENABLED : 'true').toLowerCase() === 'true';

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
const rawOrigins = process.env.FRONTEND_URL || "http://localhost:5173|http://127.0.0.1:5500";
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
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser()); 
app.use(generalLimiter);

const BASE_URL = '/api/v1';

app.get(`${BASE_URL}/system/status`, (req, res) => {
    const keyStatus = getKeyStatus();
    const serviceName = process.env.K_SERVICE || 'sci-request-system';
    const missingCriticalEnv = requiredEnv.filter(key => !process.env[key]);
    const healthy = missingCriticalEnv.length === 0;
    const status = {
        status: healthy ? 'ok' : 'degraded',
        service: serviceName,
        checks: {
            configuration: {
                status: healthy ? 'ok' : 'degraded'
            },
            oidc: {
                status: oidcEnabled ? 'ok' : 'disabled'
            },
            crypto: {
                status: keyStatus.activeLabel ? 'ok' : 'degraded'
            }
        },
        message: healthy ? 'Service is available' : 'Service is running with degraded configuration',
        now: new Date().toISOString()
    };

    res.status(healthy ? 200 : 503).json(status);
});

// Swagger Setup
const swaggerFile = path.join(__dirname, 'swagger.json');
if (process.env.NODE_ENV === 'development' && fs.existsSync(swaggerFile)) {
    const swaggerDocument = require(swaggerFile);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Security Middleware (Encryption/Decryption)
app.use(securityMiddleware);

app.use(`${BASE_URL}/auth`, authRoutes);
app.use(`${BASE_URL}/oidc`, oidcAuthRoutes);
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
  const keyStatus = getKeyStatus();
  console.log(`🚀 API running on port ${PORT}`);
  console.log(`🌍 Allowed Origins: ${allowedOrigins.join(', ')}`);
  console.log(`🔒 E2EE Security: ACTIVE`);
  console.log(`🪪 Google OIDC: ${oidcEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔑 Active Key Slot: ${keyStatus.activeLabel || 'unavailable'}`);
  console.log(`🔄 Key Rotation Fallback: ${keyStatus.rotationEnabled ? 'ENABLED' : 'DISABLED'}`);
  if (keyStatus.activeCertificateValidTo) {
    console.log(`📅 Active Certificate Valid To: ${keyStatus.activeCertificateValidTo}`);
  }
});
