const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp'); // ต้อง npm install sharp
const { PDFDocument } = require('pdf-lib'); // ต้อง npm install pdf-lib
const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { addFileToSession, deleteFileRecord, getFileRecordByKey } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Config Multer: เก็บใน RAM ชั่วคราว (เพื่อรอ Process)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // Limit 5MB
});

const sanitizeFormCode = (code) => {
    if (!code) return 'general';
    return code.replace(/[^a-zA-Z0-9-_]/g, '');
};

router.post('/', authMiddleware, strictLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const sessionId = req.user.session_id; 
    const { file_key, form_code } = req.body; 

    if (!file_key) return res.status(400).json({ error: 'Missing file_key.' });

    const safeFormCode = sanitizeFormCode(form_code);
    
    // -------------------------------------------------------------------
    // STEP 1: Overwrite Logic (หาไฟล์เก่าแล้วลบทิ้ง)
    // -------------------------------------------------------------------
    try {
        const oldFile = await getFileRecordByKey(sessionId, file_key, safeFormCode);
        
        if (oldFile) {
            console.log(`♻️ Cleanup: Removing old version of ${file_key}`);
            
            // 1.1 ลบไฟล์จาก GCS
            try {
                const gcsFile = bucket.file(oldFile.gcs_path);
                const [exists] = await gcsFile.exists();
                if (exists) await gcsFile.delete();
            } catch (gcsErr) {
                console.warn('⚠️ GCS Delete Warning:', gcsErr.message);
            }

            // 1.2 ลบ Record จาก Database
            await deleteFileRecord(sessionId, oldFile.id);
        }
    } catch (err) {
        console.error('❌ Pre-upload cleanup failed:', err.message);
        // ไม่ return error เพื่อให้ process การอัปโหลดไฟล์ใหม่ทำงานต่อได้ (Fail-Open)
    }

    // -------------------------------------------------------------------
    // STEP 2: Sanitization & Re-processing (Polyglot Protection)
    // -------------------------------------------------------------------
    let processedBuffer;
    let finalMimeType = req.file.mimetype;
    let fileExtension = path.extname(req.file.originalname).toLowerCase();

    try {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
            // ✅ Re-encode รูปภาพด้วย Sharp (ล้าง Exif/Metadata/Scripts)
            processedBuffer = await sharp(req.file.buffer)
                .rotate() // หมุนภาพตาม Exif แล้วลบ Exif ทิ้ง
                .toFormat('jpeg', { quality: 80 }) 
                .toBuffer();
            finalMimeType = 'image/jpeg';
            fileExtension = '.jpg';
        } else if (req.file.mimetype === 'application/pdf') {
            // ✅ Re-save PDF ด้วย pdf-lib (ล้าง JS objects แฝง)
            const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
            processedBuffer = Buffer.from(await pdfDoc.save()); 
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Only PDF and Images allowed.' });
        }
    } catch (processErr) {
        console.error('❌ File Sanitization Failed:', processErr.message);
        return res.status(400).json({ error: 'File verification failed. The file may be corrupted or unsafe.' });
    }

    // -------------------------------------------------------------------
    // STEP 3: Upload New File to GCS
    // -------------------------------------------------------------------
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const gcsPath = `${sessionId}/${safeFormCode}/${uniqueFileName}`;
    const blob = bucket.file(gcsPath);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: finalMimeType,
      metadata: {
        metadata: {
            // ✅ ไม่เก็บ Original Filename เพื่อป้องกัน Reflected XSS
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
        // -------------------------------------------------------------------
        // STEP 4: Save Metadata to DB
        // -------------------------------------------------------------------
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

    blobStream.end(processedBuffer); // ส่ง Buffer ที่ผ่านการฆ่าเชื้อแล้ว

  } catch (error) {
    console.error('❌ Upload Handler Error:', error.message);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

module.exports = router;