const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter, createScopedLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { isAllowedBrowserOrigin } = require('../utils/browserOrigin');
const { decryptEnvelopeKey } = require('../utils/cryptoUtils');
const { getMaxPdfSourceBytes, getMaxUploadBytes } = require('../utils/uploadSecurity');
const { wipeBufferList } = require('../utils/memorySecurity');
const { sanitizeFormCode } = require('../utils/documentJobProcessor');
const {
    DOCUMENT_JOB_TYPES,
    createDocumentJob,
    ensureDocumentJobAccess,
    getDocumentJob,
    sanitizeDocumentJobForResponse
} = require('../utils/documentJobs');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
const TEMP_UPLOAD_DIR = os.tmpdir();
const maxUploadBytes = getMaxUploadBytes();
const maxPdfSourceBytes = getMaxPdfSourceBytes();

// Rate Limiter
const uploadLimiter = createScopedLimiter('upload', {
    max: 10,
    message: { error: 'Too many uploads', message: 'Upload limit exceeded. Please wait.' },
});

// Config Multer
const upload = multer({
  storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, TEMP_UPLOAD_DIR),
      filename: (req, file, cb) =>
          cb(null, `upload-${uuidv4()}${path.extname(file.originalname || '') || '.bin'}`)
  }),
  limits: { 
      fileSize: maxUploadBytes,
      files: 1 
  }
});

// Browser uploads use cookie auth, so enforce the frontend allowlist.
const checkBrowserOrigin = (req, res, next) => {
    if (!isAllowedBrowserOrigin(req, { requireHeader: true })) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Origin is not allowed for uploads.'
        });
    }

    return next();
};

const getFileTypeDetector = async () => {
    const fileTypeModule = await import('file-type');
    const source = fileTypeModule.default || fileTypeModule;

    return source.fileTypeFromFile || source.fromFile || null;
};

const decryptFileToPath = async (encryptedPath, outputPath, encKey64, iv64, tag64) => {
    let aesKey = null;
    let iv = null;
    let authTag = null;
    try {
        aesKey = decryptEnvelopeKey(encKey64);
        iv = Buffer.from(iv64, 'base64');
        authTag = Buffer.from(tag64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
        decipher.setAuthTag(authTag);

        await pipeline(
            fs.createReadStream(encryptedPath),
            decipher,
            fs.createWriteStream(outputPath)
        );

        return outputPath;
    } catch (err) {
        console.error('🔐 Decryption Failed:', err.message);
        throw err;
    } finally {
        wipeBufferList([aesKey, iv, authTag]);
    }
};

const cleanupTempFile = async (filePath) => {
    if (!filePath) {
        return;
    }

    await fsp.rm(filePath, { force: true }).catch(() => {});
};

const uploadProcessedFileToGcs = async (blob, filePath, contentType, sessionId) =>
    new Promise((resolve, reject) => {
        const blobStream = blob.createWriteStream({
            resumable: false,
            contentType,
            metadata: { metadata: { originalName: 'secure_upload', uploadedBy: sessionId } }
        });

        blobStream.on('error', reject);
        blobStream.on('finish', resolve);
        fs.createReadStream(filePath).on('error', reject).pipe(blobStream);
    });

// Route Handler
router.post('/', uploadLimiter, authMiddleware, checkBrowserOrigin, strictLimiter, upload.single('file'), async (req, res) => {
  let verifiedInputPath = null;
  let decryptedPath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    verifiedInputPath = req.file.path;

    if (req.body.encKey && req.body.iv && req.body.tag) {
        console.log(`🔐 Decrypting file: ${req.body.file_key || 'unknown'}`);
        try {
            decryptedPath = path.join(TEMP_UPLOAD_DIR, `decrypted-${uuidv4()}.bin`);
            await decryptFileToPath(
                req.file.path,
                decryptedPath,
                req.body.encKey, 
                req.body.iv, 
                req.body.tag
            );
            verifiedInputPath = decryptedPath;
            console.log('✅ Decryption Successful');
        } catch (decryptErr) {
            return res.status(400).json({ error: 'Security Error: Cannot decrypt file.', details: decryptErr.message });
        }
    }

    const detector = await getFileTypeDetector();

    if (!detector) {
        console.error('❌ File Type Library Error: No detection method found');
        return res.status(500).json({ error: 'Internal Configuration Error: file-type library mismatch' });
    }

    const detectedType = await detector(verifiedInputPath);
    const verifiedInputStat = await fsp.stat(verifiedInputPath);
    const verifiedInputBytes = Number(verifiedInputStat.size || 0);
    
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const ALLOWED_EXTS = ['jpg', 'png', 'webp', 'pdf'];

    if (!detectedType || !ALLOWED_EXTS.includes(detectedType.ext) || !ALLOWED_MIMES.includes(detectedType.mime)) {
        return res.status(400).json({ error: 'Invalid file signature or type.' });
    }

    if (verifiedInputBytes > maxUploadBytes) {
        req.log?.warn('upload_source_limit_exceeded', {
            mime_type: detectedType.mime,
            source_bytes: verifiedInputBytes,
            source_bytes_limit: maxUploadBytes
        });
        return res.status(413).json({
            error: 'File too large',
            message: 'Uploaded file exceeds the maximum allowed size after verification.',
            data: {
                source_bytes: verifiedInputBytes,
                source_bytes_limit: maxUploadBytes
            }
        });
    }

    if (detectedType.mime === 'application/pdf' && verifiedInputBytes > maxPdfSourceBytes) {
        req.log?.warn('upload_pdf_source_limit_exceeded', {
            source_bytes: verifiedInputBytes,
            source_bytes_limit: maxPdfSourceBytes
        });
        return res.status(413).json({
            error: 'PDF too large',
            message: 'PDF file exceeds the maximum allowed size for safe processing.',
            data: {
                source_bytes: verifiedInputBytes,
                source_bytes_limit: maxPdfSourceBytes
            }
        });
    }

    const sessionId = req.user.session_id; 
    const { file_key, form_code } = req.body; 
    if (!file_key) return res.status(400).json({ error: 'Missing file_key.' });
    const safeFormCode = sanitizeFormCode(form_code);
    const rawExt = detectedType.ext ? `.${detectedType.ext}` : '.bin';
    const rawObjectPath = `${sessionId}/intake/${uuidv4()}${rawExt}`;
    const rawObject = bucket.file(rawObjectPath);
    await uploadProcessedFileToGcs(rawObject, verifiedInputPath, detectedType.mime, sessionId);

    const job = await createDocumentJob({
        type: DOCUMENT_JOB_TYPES.UPLOAD_SANITIZE,
        sessionId,
        requestedBy: {
            email: req.user.email || null,
            session_id: sessionId
        },
        payload: {
            file_key,
            form_code: safeFormCode,
            raw_gcs_path: rawObjectPath,
            detected_mime: detectedType.mime,
            detected_ext: detectedType.ext,
            source_bytes: verifiedInputBytes
        },
        metadata: {
            source_bytes: verifiedInputBytes
        }
    });

    req.log?.audit('upload_job_queued', {
        file_key,
        form_code: safeFormCode,
        mime_type: detectedType.mime,
        job_id: job.id,
        raw_gcs_path: rawObjectPath,
        source_bytes: verifiedInputBytes
    });
    res.status(202).json({
        status: 'queued',
        job: sanitizeDocumentJobForResponse(job)
    });

  } catch (error) {
    req.log?.error('upload_handler_error', { message: error.message });
    res.status(500).json({ error: 'Internal Server Error.' });
  } finally {
    await cleanupTempFile(req.file?.path);
    await cleanupTempFile(decryptedPath);
  }
});

router.get('/jobs/:jobId', authMiddleware, async (req, res) => {
    const job = await getDocumentJob(req.params.jobId);
    if (!job || job.type !== DOCUMENT_JOB_TYPES.UPLOAD_SANITIZE) {
        return res.status(404).json({ error: 'Job not found.' });
    }

    if (!ensureDocumentJobAccess(job, req.user)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json({
        status: 'success',
        job: sanitizeDocumentJobForResponse(job)
    });
});

module.exports = router;
