const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
const { addFileToSession } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Route 1: Signed URL (เหมือนเดิม)
router.post('/signed-url', authMiddleware, strictLimiter, async (req, res) => {
  // ... (โค้ดเดิมของคุณ OK แล้ว) ...
  try {
    const { file_type, file_key, file_size } = req.body;
    const sessionId = req.session.session_id;

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file_type)) {
      return res.status(400).json({ error: 'Invalid file type.' });
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file_size && file_size > MAX_SIZE) {
      return res.status(400).json({ error: `File size exceeds limit 5MB.` });
    }

    const extensionMap = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = extensionMap[file_type] || 'bin';
    
    const uniqueFileName = `${uuidv4()}.${extension}`;
    const gcsPath = `${sessionId}/${uniqueFileName}`;
    const file = bucket.file(gcsPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: file_type,
      extensionHeaders: {
          'Content-Length': file_size // ✅ บังคับขนาดไฟล์ตั้งแต่ตอน Upload
      }
    });

    res.json({
      upload_url: url,
      file_key: file_key,
      gcs_path: gcsPath 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Route 2: Finalize Upload (เพิ่ม Security Check)
router.post('/finalize', authMiddleware, async (req, res) => {
    try {
        const { file_key, gcs_path, file_type } = req.body;
        const sessionId = req.session.session_id;

        // Security Check 1: ตรวจสอบว่า Path ที่ส่งมา เป็นของ Session นี้จริงๆ (ป้องกัน Path Traversal/Hijacking)
        if (!gcs_path.startsWith(`${sessionId}/`)) {
            console.warn(`⚠️ Security Alert: Session ${sessionId} tried to claim file outside scope: ${gcs_path}`);
            return res.status(403).json({ error: 'Invalid file path scope' });
        }

        // Security Check 2: ตรวจสอบว่าไฟล์มีอยู่จริงบน GCS
        const file = bucket.file(gcs_path);
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).json({ error: 'File verification failed: File not found in storage' });
        }

        // Security Check 3 (Optional but recommended): ตรวจสอบ Metadata ของไฟล์บน GCS
        const [metadata] = await file.getMetadata();
        if (metadata.contentType !== file_type) {
             console.warn(`⚠️ MimeType Mismatch: Claimed ${file_type}, Actual ${metadata.contentType}`);
             // อาจจะแค่ warn หรือ reject เลยก็ได้
        }

        await addFileToSession(sessionId, {
            file_key,
            gcs_path,
            file_type
        });

        console.log(`✅ Saved file to DB: ${file_key} for session ${sessionId}`);
        res.json({ status: 'success' });

    } catch (error) {
        console.error('Finalize Error:', error);
        res.status(500).json({ error: 'Failed to save record' });
    }
});

module.exports = router;