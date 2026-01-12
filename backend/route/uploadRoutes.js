const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// 5.1 POST /upload/signed-url
router.post('/signed-url', authMiddleware, async (req, res) => {
  try {
    const { file_type, file_key, file_size } = req.body; // รับ file_size เพิ่มเพื่อตรวจสอบ
    const sessionId = req.session.session_id;

    // 1. Validate File Type (อนุญาตแค่ PDF และรูปภาพ)
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file_type)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF and Images (JPEG, PNG, WEBP) are allowed.' 
      });
    }

    // 2. Validate File Size (ต้องไม่เกิน 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file_size && file_size > MAX_SIZE) {
      return res.status(400).json({ 
        error: `File size exceeds limit. Maximum allowed is 5MB. (Your file: ${(file_size / 1024 / 1024).toFixed(2)} MB)` 
      });
    }

    // สร้าง Path: sess_xxxx/file_key.extension
    const extensionMap = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const extension = extensionMap[file_type] || 'bin';
    const gcsPath = `${sessionId}/${file_key}.${extension}`;
    const file = bucket.file(gcsPath);

    // Config สำหรับ Signed URL
    const options = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // URL อายุ 15 นาที
      contentType: file_type,
    };

    // 3. Security: ถ้า Client ส่งขนาดไฟล์มา ให้ผูก Content-Length เข้ากับ Signature ด้วย
    // ทำให้ Client ต้องอัปโหลดไฟล์ขนาดเท่านี้เป๊ะๆ เท่านั้น (โกงขนาดไม่ได้)
    if (file_size) {
      options.extensionHeaders = {
        'Content-Length': file_size.toString()
      };
    }

    // สร้าง Signed URL
    const [url] = await file.getSignedUrl(options);

    res.json({
      upload_url: url,
      gcs_path: gcsPath
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

module.exports = router;