const express = require('express');
const router = express.Router();
const { Storage } = require('@google-cloud/storage');
const authMiddleware = require('../middlewares/authMiddleware');

const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * @swagger
 * tags:
 * - name: Upload
 * description: การจัดการไฟล์เอกสาร
 */

/**
 * @swagger
 * /upload/signed-url:
 * post:
 * summary: ขอ Signed URL เพื่ออัปโหลดไฟล์
 * tags: [Upload]
 * description: "**⚠️ E2EE Required**"
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - file_type
 * - file_key
 * properties:
 * file_type:
 * type: string
 * example: application/pdf
 * file_key:
 * type: string
 * example: transcript
 * file_size:
 * type: integer
 * description: ขนาดไฟล์ (bytes)
 * responses:
 * 200:
 * description: สำเร็จ
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * upload_url:
 * type: string
 * gcs_path:
 * type: string
 * 400:
 * description: ไฟล์ไม่ถูกต้อง (ผิดประเภท หรือขนาดเกิน 5MB)
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * 401:
 * description: Unauthorized (Token ไม่ถูกต้อง)
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * 500:
 * description: Internal Server Error (GCS Error)
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 */
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
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file_size && file_size > MAX_SIZE) {
      return res.status(400).json({ 
        error: `File size exceeds limit. Maximum allowed is 5MB.` 
      });
    }

    const extensionMap = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const extension = extensionMap[file_type] || 'bin';
    const gcsPath = `${sessionId}/${file_key}.${extension}`;
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