const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initSessionRecord } = require('../utils/dbUtils');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/init', strictLimiter, async (req, res) => {
  try {
      // ✅ เช็คก่อนว่ามี Cookie เดิมอยู่แล้วไหม (ถ้ามี ใช้ Session ID เดิม)
      let sessionId;
      const existingToken = req.cookies.session_token;
      
      if (existingToken) {
          try {
              const decoded = jwt.verify(existingToken, process.env.JWT_SECRET);
              sessionId = decoded.session_id;
              console.log(`♻️ Resuming session: ${sessionId}`);
          } catch (e) {
              // Token เก่าใช้ไม่ได้ สร้างใหม่
              sessionId = `sess_${uuidv4().split('-')[0]}`;
          }
      } else {
          sessionId = `sess_${uuidv4().split('-')[0]}`;
      }

      const expiresIn = 86400; // 24 ชั่วโมง (เพิ่มจาก 30 นาที เพื่อความสะดวกในการเทส)
      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      // Init Firestore (Idempotent: ถ้ามีอยู่แล้วก็แค่อัปเดต)
      await initSessionRecord(sessionId);

      // ✅ ฝัง Cookie (Secure & HttpOnly)
      res.cookie('session_token', token, {
          httpOnly: true,    // JS อ่านไม่ได้ (ป้องกัน XSS)
          secure: process.env.NODE_ENV === 'production', // ใช้ HTTPS ใน Production
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          maxAge: expiresIn * 1000
      });

      res.json({
        message: 'Session initialized',
        session_id: sessionId // ส่ง ID กลับไปเผื่อใช้ประโยชน์ (แต่ Token อยู่ใน Cookie แล้ว)
      });

  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;