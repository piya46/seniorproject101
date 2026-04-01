require('dotenv').config();
const express = require('express');
const { Storage } = require('@google-cloud/storage');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet'); 
const requestContextMiddleware = require('./middlewares/requestContextMiddleware');
const securityMiddleware = require('./middlewares/securityMiddleware');
const authMiddleware = require('./middlewares/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const authV2Routes = require('./routes/authV2Routes');
const oidcAuthRoutes = require('./routes/oidcAuthRoutes');
const { generalLimiter } = require('./middlewares/rateLimitMiddleware');
const { getKeyStatus, getPfsV2Status } = require('./utils/cryptoUtils');
const { cleanupStaleTempFilesOnStartup } = require('./utils/tempFileCleanup');
const { getAllowedOrigins } = require('./utils/browserOrigin');
const { parseTrustProxySetting } = require('./utils/runtimeSecurityConfig');

// Swagger Imports
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');

const app = express();
const oidcEnabled = String(process.env.OIDC_ENABLED !== undefined ? process.env.OIDC_ENABLED : 'true').toLowerCase() === 'true';
const allowBearerSessionToken = String(process.env.ALLOW_BEARER_SESSION_TOKEN || 'false').toLowerCase() === 'true';
const storage = new Storage();

// --- Security Check ---
const requiredEnv = ['JWT_SECRET', 'GCP_PROJECT_ID', 'GCS_BUCKET_NAME', 'Gb_PRIVATE_KEY_BASE64', 'Gb_PUBLIC_KEY_BASE64'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing secrets: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && allowBearerSessionToken) {
  console.error('❌ CRITICAL ERROR: ALLOW_BEARER_SESSION_TOKEN must remain disabled in production.');
  process.exit(1);
}

app.set('trust proxy', parseTrustProxySetting());

// ✅ SECURITY UPGRADE: Helmet with strict CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], 
            scriptSrc: ["'self'"], // ห้ามรัน Inline Script
            objectSrc: ["'none'"], // ปิดช่องโหว่ Flash/Plugin
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS Setup
const allowedOrigins = getAllowedOrigins();

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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true 
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser()); 
app.use(requestContextMiddleware);
app.use(generalLimiter);

const BASE_URL = '/api/v1';
const BASE_URL_V2 = '/api/v2';

const probeSignedUrlGeneration = async () => {
    const bucketName = process.env.GCS_BUCKET_NAME;

    if (!bucketName) {
        throw new Error('GCS_BUCKET_NAME is missing.');
    }

    const bucket = storage.bucket(bucketName);
    const probeFile = bucket.file(`healthchecks/signed-url-probe-${Date.now()}.txt`);
    const expiresAt = Date.now() + (5 * 60 * 1000);

    await probeFile.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
    });

    return {
        bucket_name: bucketName,
        expires_at: new Date(expiresAt).toISOString()
    };
};

app.get(`${BASE_URL}/system/status`, (req, res) => {
    const keyStatus = getKeyStatus();
    const serviceName = process.env.K_SERVICE || 'ai-formcheck-backend';
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
            },
            pfs_v2: {
                status: getPfsV2Status().enabled ? 'ok' : 'disabled'
            }
        },
        message: healthy ? 'Service is available' : 'Service is running with degraded configuration',
        now: new Date().toISOString()
    };

    res.status(healthy ? 200 : 503).json(status);
});

app.get(`${BASE_URL}/system/status/storage-signing`, authMiddleware, async (req, res) => {
    try {
        const probe = await probeSignedUrlGeneration();

        return res.status(200).json({
            status: 'ok',
            checks: {
                storage_signing: {
                    status: 'ok'
                }
            },
            probe,
            now: new Date().toISOString()
        });
    } catch (error) {
        console.error('Storage signing probe failed:', error);
        return res.status(503).json({
            status: 'degraded',
            checks: {
                storage_signing: {
                    status: 'degraded'
                }
            },
            error: 'Storage signing probe failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Storage signing is unavailable.',
            now: new Date().toISOString()
        });
    }
});

app.get(`${BASE_URL}/system/status/details`, authMiddleware, (req, res) => {
    const keyStatus = getKeyStatus();
    const serviceName = process.env.K_SERVICE || 'ai-formcheck-backend';
    const serviceRegion = process.env.K_REGION || process.env.APP_REGION || process.env.REGION || null;
    const projectNumber = process.env.GCP_PROJECT_NUMBER || null;
    const runAppUrl = serviceRegion && projectNumber
        ? `https://${serviceName}-${projectNumber}.${serviceRegion}.run.app`
        : null;
    const missingCriticalEnv = requiredEnv.filter(key => !process.env[key]);
    const healthy = missingCriticalEnv.length === 0;
    const pfsV2Status = getPfsV2Status();

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        service: serviceName,
        version: process.env.npm_package_version || 'unknown',
        checks: {
            configuration: {
                status: healthy ? 'ok' : 'degraded',
                missing_required_env: missingCriticalEnv
            },
            oidc: {
                status: oidcEnabled ? 'ok' : 'disabled'
            },
            crypto: {
                status: keyStatus.activeLabel ? 'ok' : 'degraded',
                active_key_slot: keyStatus.activeLabel || null,
                active_certificate_valid_to: keyStatus.activeCertificateValidTo || null,
                rotation_enabled: keyStatus.rotationEnabled
            },
            pfs_v2: {
                status: pfsV2Status.enabled ? 'ok' : 'disabled'
            }
        },
        runtime: {
            node_env: process.env.NODE_ENV || 'development',
            port: Number(process.env.PORT || 8080),
            region: serviceRegion,
            revision: process.env.K_REVISION || null,
            uptime_seconds: Math.floor(process.uptime()),
            service_url: runAppUrl
        },
        auth: {
            oidc_enabled: oidcEnabled,
            allowed_origins: allowedOrigins,
            allowed_domains: String(process.env.OIDC_ALLOWED_DOMAINS || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            hosted_domain_required: String(process.env.OIDC_REQUIRE_HOSTED_DOMAIN || 'true').toLowerCase() === 'true'
        },
        crypto: {
            e2ee_enabled: true,
            active_key_slot: keyStatus.activeLabel || null,
            key_rotation_enabled: keyStatus.rotationEnabled,
            active_certificate_valid_to: keyStatus.activeCertificateValidTo || null,
            pfs_v2_enabled: pfsV2Status.enabled,
            pfs_v2_curve: pfsV2Status.curve,
            pfs_v2_handshake_ttl_ms: pfsV2Status.handshake_ttl_ms,
            pfs_v2_cached_key_id: pfsV2Status.cached_key_id,
            pfs_v2_cached_key_expires_at: pfsV2Status.cached_key_expires_at
        },
        integrations: {
            gcp_project_id: process.env.GCP_PROJECT_ID || null,
            gcp_project_number: projectNumber,
            gcs_bucket_name: process.env.GCS_BUCKET_NAME || null,
            ai_location: process.env.AI_LOCATION || 'us-central1',
            tech_support_target_email: process.env.TECH_SUPPORT_TARGET_EMAIL || null,
            ai_daily_token_limit: Number(process.env.AI_DAILY_TOKEN_LIMIT || 50000),
            ai_chat_daily_token_limit: Number(process.env.AI_CHAT_DAILY_TOKEN_LIMIT || process.env.AI_DAILY_TOKEN_LIMIT || 50000),
            ai_validation_daily_token_limit: Number(process.env.AI_VALIDATION_DAILY_TOKEN_LIMIT || process.env.AI_DAILY_TOKEN_LIMIT || 50000),
            ai_usage_retention_days: Number(process.env.AI_USAGE_RETENTION_DAYS || 30)
        },
        now: new Date().toISOString()
    });
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
app.use(`${BASE_URL_V2}/auth`, authV2Routes);
app.use(`${BASE_URL}/oidc`, oidcAuthRoutes);
app.use(`${BASE_URL}/profile`, require('./routes/profileRoutes'));
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
    const statusCode = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;

    if (req.log) {
        req.log.error('unhandled_error', {
            status_code: statusCode,
            message: err.message
        });
    } else {
        console.error('🔥 Unhandled Error:', err);
    }

    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : (err.error || err.name || 'Request Error'),
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

const PORT = process.env.PORT || 8080;

const startServer = async () => {
    const tempCleanupResult = await cleanupStaleTempFilesOnStartup();

    if (tempCleanupResult.removedFiles > 0 || tempCleanupResult.scannedFiles > 0) {
        console.log(
            `🧹 Startup temp cleanup scanned ${tempCleanupResult.scannedFiles} file(s) and removed ${tempCleanupResult.removedFiles} stale file(s) from ${tempCleanupResult.tempDir}`
        );
    }

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
};

startServer().catch((error) => {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
});
