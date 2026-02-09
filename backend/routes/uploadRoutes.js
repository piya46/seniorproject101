const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middlewares/authMiddleware');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware'); 
// ✅ Import DB function
const { addFileToSession } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Route 1: สร้าง URL สำหรับอัปโหลด
router.post('/signed-url', authMiddleware, strictLimiter, async (req, res) => {
  try {
    const { file_type, file_key, file_size } = req.body;
    const sessionId = req.session.session_id;

    // Validate Check
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
    
    // ตั้งชื่อไฟล์
    const uniqueFileName = `${uuidv4()}.${extension}`;
    const gcsPath = `${sessionId}/${uniqueFileName}`;
    const file = bucket.file(gcsPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: file_type,
    });

    // ส่ง gcs_path กลับไปให้ frontend เพื่อเอามายืนยันตอน finalize
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

// ✅ Route 2: Finalize Upload (เพิ่มอันนี้!)
// Frontend จะเรียก route นี้เมื่ออัปโหลดเสร็จ เพื่อบันทึกลง DB
router.post('/finalize', authMiddleware, async (req, res) => {
    try {
        const { file_key, gcs_path, file_type } = req.body;
        const sessionId = req.session.session_id;

        if (!gcs_path || !file_key) {
            return res.status(400).json({ error: 'Missing metadata' });
        }

        // 🔥 บันทึกลง Firestore ตรงนี้
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