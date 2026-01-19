const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * @swagger
 * tags:
 * - name: Session
 * description: การจัดการ Session เริ่มต้น
 */

/**
 * @swagger
 * /session/init:
 * post:
 * summary: สร้าง Session ใหม่ (Handshake)
 * tags: [Session]
 * security: [] 
 * description: >
 * สร้าง Session ID และ Token สำหรับใช้งาน
 * **⚠️ E2EE Required:** Payload ขาเข้าต้องว่างเปล่า (Empty Object) แต่ต้องผ่านการเข้ารหัส
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * example: {}
 * responses:
 * 200:
 * description: สร้าง Session สำเร็จ
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * session_token:
 * type: string
 * description: JWT Token
 * expires_in:
 * type: integer
 * session_id:
 * type: string
 * 403:
 * description: Forbidden (Payload ไม่ได้เข้ารหัสมา หรือถอดรหัสไม่ได้)
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 */
router.post('/init', (req, res) => {
  const sessionId = `sess_${uuidv4().split('-')[0]}`; 
  const expiresIn = 1800; // 30 mins

  const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

  res.json({
    session_token: token,
    expires_in: expiresIn,
    session_id: sessionId
  });
});

module.exports = router;