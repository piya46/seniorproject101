const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { addFileToSession } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Config Multer: เก็บใน RAM ชั่วคราว (เหมาะกับ Cloud Run)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

const sanitizeFormCode = (code) => {
    if (!code) return 'general';
    return code.replace(/[^a-zA-Z0-9-_]/g, '');
};

router.post('/', authMiddleware, strictLimiter, upload.single('file'), async (req, res) => {
  try {
    // 1. Validation เบื้องต้น
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    // ✅ ใช้ req.user
    const sessionId = req.user.session_id; 
    const { file_key, form_code } = req.body; 

    if (!file_key) return res.status(400).json({ error: 'Missing file_key.' });

    // 2. File Type Validation
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type.' });
    }

    // 3. กำหนด Path (Backend Control)
    const safeFormCode = sanitizeFormCode(form_code);
    const fileExtension = path.extname(req.file.originalname) || '.bin';
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    
    // Path: sessionId / formCode / uuid.ext
    const gcsPath = `${sessionId}/${safeFormCode}/${uniqueFileName}`;
    const blob = bucket.file(gcsPath);

    // 4. Upload Stream
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
      metadata: {
        metadata: {
            originalName: req.file.originalname,
            uploadedBy: sessionId,
            formCode: safeFormCode,
            fileKey: file_key
        }
      }
    });

    blobStream.on('error', (err) => {
      console.error('GCS Upload Error:', err);
      res.status(500).json({ error: 'Upload failed.' });
    });

    blobStream.on('finish', async () => {
      try {
        // 5. Save Metadata to DB (รวมถึง Path ที่ซ่อนไว้)
        await addFileToSession(sessionId, {
            file_key: file_key,
            gcs_path: gcsPath,
            file_type: req.file.mimetype,
            form_code: safeFormCode
        });

        // 6. Response (ไม่ส่ง gcs_path กลับไป)
        res.json({
            status: 'success',
            data: {
                file_key: file_key,
                form_code: safeFormCode,
                file_type: req.file.mimetype
            }
        });

      } catch (dbError) {
        console.error('DB Save Error:', dbError);
        res.status(500).json({ error: 'File uploaded but metadata save failed.' });
      }
    });

    blobStream.end(req.file.buffer);

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Server Error.' });
  }
});

module.exports = router;