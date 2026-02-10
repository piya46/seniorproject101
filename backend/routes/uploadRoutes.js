const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const rateLimit = require('express-rate-limit'); // ✅ ต้องลง npm install express-rate-limit เพิ่ม

const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { addFileToSession, deleteFileRecord, getFileRecordByKey } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// ✅ SECURITY UPGRADE 1: สร้าง Rate Limiter แยกเฉพาะสำหรับ Upload
// ป้องกันการระดมยิงไฟล์ใส่ Server จน RAM เต็ม
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 นาที
    max: 10, // อนุญาตแค่ 10 Request ต่อ IP (สำหรับการ Upload)
    message: { error: 'Too many uploads', message: 'Upload limit exceeded. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ✅ SECURITY UPGRADE 2: Config Multer ให้เข้มงวดที่สุด
const upload = multer({
  storage: multer.memoryStorage(), // ยังใช้ RAM แต่มี limiter คุมหน้าด่านแล้ว
  limits: { 
      fileSize: 5 * 1024 * 1024, // 5MB (Hard Limit)
      files: 1 // รับแค่ทีละ 1 ไฟล์เท่านั้น
  }
});

const sanitizeFormCode = (code) => {
    if (!code) return 'general';
    return code.replace(/[^a-zA-Z0-9-_]/g, '');
};

// นำ uploadLimiter มาแปะหน้าสุด
router.post('/', uploadLimiter, authMiddleware, strictLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    // ✅ SECURITY UPGRADE 3: Magic Number Validation
    const { fileTypeFromBuffer } = await import('file-type');
    const detectedType = await fileTypeFromBuffer(req.file.buffer);
    
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

    // --- STEP 2: Sanitization & Re-processing ---
    let processedBuffer;
    let finalMimeType = detectedType.mime;
    let fileExtension = `.${detectedType.ext}`;

    try {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(finalMimeType)) {
            processedBuffer = await sharp(req.file.buffer)
                .rotate()
                .toFormat('jpeg', { quality: 80 }) 
                .toBuffer();
            finalMimeType = 'image/jpeg';
            fileExtension = '.jpg';
        } else if (finalMimeType === 'application/pdf') {
            const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
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