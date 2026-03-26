const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const rateLimit = require('express-rate-limit');

const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { addFileToSession, deleteFileRecord, getDecryptedSessionFiles } = require('../utils/dbUtils');
const { findFilesByKeyAndForm, sortFilesByUploadedAtDesc } = require('../utils/fileSelection');
const { isAllowedBrowserOrigin } = require('../utils/browserOrigin');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Rate Limiter
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: { error: 'Too many uploads', message: 'Upload limit exceeded. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Config Multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1 
  }
});

const sanitizeFormCode = (code) => {
    if (!code) return 'general';
    return code.replace(/[^a-zA-Z0-9-_]/g, '');
};

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

// 🔒 Helper: Decrypt File
const decryptFileBuffer = (encryptedBuffer, encKey64, iv64, tag64) => {
    try {
        if (!process.env.Gb_PRIVATE_KEY_BASE64) throw new Error('Server Private Key missing');

        const privateKeyPem = Buffer.from(process.env.Gb_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');

        // 1. Decrypt AES key with native OpenSSL-backed crypto.
        const aesKey = crypto.privateDecrypt(
            {
                key: privateKeyPem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encKey64, 'base64')
        );

        // 2. Decrypt file content (AES-256-GCM) with native crypto.
        const iv = Buffer.from(iv64, 'base64');
        const authTag = Buffer.from(tag64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(encryptedBuffer),
            decipher.final()
        ]);

        return decrypted;
    } catch (err) {
        console.error('🔐 Decryption Failed:', err.message);
        throw err;
    }
};

// Route Handler
router.post('/', uploadLimiter, authMiddleware, checkBrowserOrigin, strictLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    let finalBuffer = req.file.buffer;

    // ✅ Decryption Logic
    if (req.body.encKey && req.body.iv && req.body.tag) {
        console.log(`🔐 Decrypting file: ${req.body.file_key || 'unknown'}`);
        try {
            finalBuffer = decryptFileBuffer(
                req.file.buffer, 
                req.body.encKey, 
                req.body.iv, 
                req.body.tag
            );
            console.log('✅ Decryption Successful');
        } catch (decryptErr) {
            return res.status(400).json({ error: 'Security Error: Cannot decrypt file.', details: decryptErr.message });
        }
    }

    // ✅ FIX BUG 500: แก้ไขการเรียกใช้ file-type ให้ถูกต้อง
    const fileTypeModule = await import('file-type');
    
    // ตรวจสอบว่าใช้คำสั่งไหนได้ (รองรับทั้ง v16 และ v17+)
    const detector = fileTypeModule.fileTypeFromBuffer || fileTypeModule.fromBuffer || fileTypeModule.default?.fromBuffer;
    
    if (!detector) {
        console.error('❌ File Type Library Error: No detection method found');
        return res.status(500).json({ error: 'Internal Configuration Error: file-type library mismatch' });
    }

    const detectedType = await detector(finalBuffer);
    
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const ALLOWED_EXTS = ['jpg', 'png', 'webp', 'pdf'];

    if (!detectedType || !ALLOWED_EXTS.includes(detectedType.ext) || !ALLOWED_MIMES.includes(detectedType.mime)) {
        return res.status(400).json({ error: 'Invalid file signature or type.' });
    }

    // ... Process Upload ...
    const sessionId = req.user.session_id; 
    const { file_key, form_code } = req.body; 
    if (!file_key) return res.status(400).json({ error: 'Missing file_key.' });
    const safeFormCode = sanitizeFormCode(form_code);

    // Sanitize Logic
    let processedBuffer;
    let finalMimeType = detectedType.mime;
    let fileExtension = `.${detectedType.ext}`;

    try {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            processedBuffer = await sharp(finalBuffer).rotate().toFormat('jpeg', { quality: 80 }).toBuffer();
            finalMimeType = 'image/jpeg';
            fileExtension = '.jpg';
        } else if (finalMimeType === 'application/pdf') {
            const pdfDoc = await PDFDocument.load(finalBuffer, { ignoreEncryption: true });
            processedBuffer = Buffer.from(await pdfDoc.save()); 
        }
    } catch (processErr) {
        console.error('Sanitization Error:', processErr);
        return res.status(400).json({ error: 'File verification failed.' });
    }

    // Upload to GCS
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const gcsPath = `${sessionId}/${safeFormCode}/${uniqueFileName}`;
    const blob = bucket.file(gcsPath);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: finalMimeType,
      metadata: { metadata: { originalName: 'secure_upload', uploadedBy: sessionId } }
    });

    blobStream.on('error', (err) => {
        console.error('GCS Upload Error:', err);
        res.status(500).json({ error: 'Storage upload failed.' });
    });

    blobStream.on('finish', async () => {
      try {
          const existingFiles = await getDecryptedSessionFiles(sessionId);
          const obsoleteFiles = sortFilesByUploadedAtDesc(
              findFilesByKeyAndForm(existingFiles, file_key, safeFormCode)
          );

          for (const obsoleteFile of obsoleteFiles) {
              try {
                  await bucket.file(obsoleteFile.gcs_path).delete({ ignoreNotFound: true });
              } catch (storageDeleteError) {
                  console.warn(`⚠️ Skip deleting old GCS file ${obsoleteFile.gcs_path}:`, storageDeleteError.message);
              }

              await deleteFileRecord(sessionId, obsoleteFile.id);
          }

          await addFileToSession(sessionId, {
              file_key, gcs_path: gcsPath, file_type: finalMimeType, form_code: safeFormCode
          });
          res.json({ status: 'success', data: { file_key, form_code: safeFormCode } });
      } catch (dbError) {
          console.error('DB Error:', dbError);
          res.status(500).json({ error: 'Database error' });
      }
    });

    blobStream.end(processedBuffer);

  } catch (error) {
    console.error('❌ Upload Handler Error:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

module.exports = router;
