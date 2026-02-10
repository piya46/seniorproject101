const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const rateLimit = require('express-rate-limit');
const forge = require('node-forge'); // ✅ เพิ่ม: Library สำหรับถอดรหัส

const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { addFileToSession, deleteFileRecord, getFileRecordByKey } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Rate Limiter เฉพาะ Upload
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
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 1 
  }
});

const sanitizeFormCode = (code) => {
    if (!code) return 'general';
    return code.replace(/[^a-zA-Z0-9-_]/g, '');
};

// 🔒 Helper Function: ถอดรหัสไฟล์
const decryptFileBuffer = (encryptedBuffer, encKey64, iv64, tag64) => {
    try {
        // 1. เตรียม Private Key ของ Server
        if (!process.env.Gb_PRIVATE_KEY_BASE64) throw new Error('Server Private Key missing');
        const privateKeyPem = Buffer.from(process.env.Gb_PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
        const rsaPrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);

        // 2. ถอดรหัส AES Key (ที่ถูก Encrypt มาด้วย Public Key ของ Server)
        const aesKey = rsaPrivateKey.decrypt(forge.util.decode64(encKey64), 'RSA-OAEP', { md: forge.md.sha256.create() });

        // 3. ถอดรหัสเนื้อไฟล์ (AES-GCM)
        const decipher = forge.cipher.createDecipher('AES-GCM', aesKey);
        decipher.start({ 
            iv: forge.util.decode64(iv64), 
            tag: forge.util.decode64(tag64) 
        });
        
        // แปลง Buffer เป็น Binary String เพื่อให้ forge อ่านได้
        decipher.update(forge.util.createBuffer(encryptedBuffer.toString('binary')));
        
        const pass = decipher.finish();
        if (!pass) throw new Error('Decryption integrity check failed (Tag Mismatch)');

        // แปลงกลับเป็น NodeJS Buffer
        return Buffer.from(decipher.output.getBytes(), 'binary');

    } catch (err) {
        console.error('🔐 Decryption Failed:', err.message);
        throw err; 
    }
};

// Route Handler
router.post('/', uploadLimiter, authMiddleware, strictLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    let finalBuffer = req.file.buffer;

    // ✅ SECURITY UPGRADE: ตรวจสอบและถอดรหัสถ้ามีการเข้ารหัสส่งมา
    if (req.body.encKey && req.body.iv && req.body.tag) {
        console.log(`🔐 Processing Encrypted Upload: ${req.body.file_key || 'unknown'}`);
        try {
            finalBuffer = decryptFileBuffer(
                req.file.buffer, 
                req.body.encKey, 
                req.body.iv, 
                req.body.tag
            );
            console.log('✅ Decryption Successful');
        } catch (decryptErr) {
            return res.status(400).json({ error: 'Security Error: Unable to decrypt file. Integrity check failed.' });
        }
    }

    // ✅ SECURITY UPGRADE 3: Magic Number Validation (ใช้ finalBuffer ที่ถอดรหัสแล้ว)
    const { fileTypeFromBuffer } = await import('file-type');
    const detectedType = await fileTypeFromBuffer(finalBuffer);
    
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const ALLOWED_EXTS = ['jpg', 'png', 'webp', 'pdf'];

    if (!detectedType || !ALLOWED_EXTS.includes(detectedType.ext) || !ALLOWED_MIMES.includes(detectedType.mime)) {
        console.warn(`⛔ Security: File signature mismatch! Detected: ${detectedType ? detectedType.mime : 'Unknown'}`);
        return res.status(400).json({ error: 'Security Violation: Invalid file signature.' });
    }

    const sessionId = req.user.session_id; 
    const { file_key, form_code } = req.body; 

    if (!file_key) return res.status(400).json({ error: 'Missing file_key.' });

    const safeFormCode = sanitizeFormCode(form_code);
    
    // --- STEP 1: Overwrite Logic (Cleanup Old File) ---
    try {
        const oldFile = await getFileRecordByKey(sessionId, file_key, safeFormCode);
        if (oldFile) {
            console.log(`♻️ Cleanup: Removing old version of ${file_key}`);
            try {
                const gcsFile = bucket.file(oldFile.gcs_path);
                const [exists] = await gcsFile.exists();
                if (exists) await gcsFile.delete();
            } catch (gcsErr) {
                console.warn('⚠️ GCS Delete Warning:', gcsErr.message);
            }
            await deleteFileRecord(sessionId, oldFile.id);
        }
    } catch (err) {
        console.error('❌ Pre-upload cleanup failed:', err.message);
    }

    // --- STEP 2: Sanitization & Re-processing (ใช้ finalBuffer) ---
    let processedBuffer;
    let finalMimeType = detectedType.mime;
    let fileExtension = `.${detectedType.ext}`;

    try {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            processedBuffer = await sharp(finalBuffer) // ใช้ Buffer ที่ถอดรหัสแล้ว
                .rotate()
                .toFormat('jpeg', { quality: 80 }) 
                .toBuffer();
            finalMimeType = 'image/jpeg';
            fileExtension = '.jpg';
        } else if (finalMimeType === 'application/pdf') {
            const pdfDoc = await PDFDocument.load(finalBuffer, { ignoreEncryption: true }); // ใช้ Buffer ที่ถอดรหัสแล้ว
            processedBuffer = Buffer.from(await pdfDoc.save()); 
        }
    } catch (processErr) {
        console.error('❌ File Sanitization Failed:', processErr.message);
        return res.status(400).json({ error: 'File verification failed. The file may be corrupted or unsafe.' });
    }

    // --- STEP 3: Upload New File to GCS ---
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const gcsPath = `${sessionId}/${safeFormCode}/${uniqueFileName}`;
    const blob = bucket.file(gcsPath);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: finalMimeType,
      metadata: {
        metadata: {
            originalName: 'sanitized_upload', 
            uploadedBy: sessionId,
            formCode: safeFormCode,
            fileKey: file_key
        }
      }
    });

    blobStream.on('error', (err) => {
      console.error('❌ GCS Upload Error:', err.message); 
      res.status(500).json({ error: 'Cloud storage upload failed.' });
    });

    blobStream.on('finish', async () => {
      try {
        await addFileToSession(sessionId, {
            file_key: file_key,
            gcs_path: gcsPath,
            file_type: finalMimeType,
            form_code: safeFormCode
        });

        res.json({
            status: 'success',
            data: {
                file_key: file_key,
                form_code: safeFormCode,
                file_type: finalMimeType
            }
        });

      } catch (dbError) {
        console.error('❌ DB Save Error:', dbError.message);
        res.status(500).json({ error: 'File uploaded but metadata save failed.' });
      }
    });

    blobStream.end(processedBuffer);

  } catch (error) {
    console.error('❌ Upload Handler Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

module.exports = router;