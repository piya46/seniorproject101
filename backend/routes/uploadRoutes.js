const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middlewares/authMiddleware');
const { addFileToSession } = require('../utils/dbUtils');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

router.post('/signed-url', authMiddleware, async (req, res) => {
  try {
    const { file_type, file_key, file_size } = req.body;
    const sessionId = req.session.session_id;

    // 1. Validate File Type
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file_type)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF and Images (JPEG, PNG, WEBP) are allowed.' 
      });
    }

    // 2. Validate File Size
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file_size && file_size > MAX_SIZE) {
      return res.status(400).json({ 
        error: `File size exceeds limit. Maximum allowed is 5MB.` 
      });
    }

    // 3. Generate Secure Path
    const extensionMap = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const extension = extensionMap[file_type] || 'bin';
    
    // ✅ ใช้ UUID ตั้งชื่อไฟล์เพื่อความปลอดภัย (เดา Path ไม่ได้)
    const uniqueFileName = `${uuidv4()}.${extension}`;
    const gcsPath = `${sessionId}/${uniqueFileName}`;
    const file = bucket.file(gcsPath);

    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: file_type,
    };

    if (file_size) {
      options.extensionHeaders = {
        'Content-Length': file_size.toString()
      };
    }

    const [url] = await file.getSignedUrl(options);

    await addFileToSession(sessionId, {
        file_key: file_key || 'unknown',
        gcs_path: gcsPath,
        file_type: file_type
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

module.exports = router;