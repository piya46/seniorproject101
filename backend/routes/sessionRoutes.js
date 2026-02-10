const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // ใช้ crypto แทน uuid เพื่อ entropy ที่สูงกว่า
const { initSessionRecord } = require('../utils/dbUtils');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/init', strictLimiter, async (req, res) => {
  try {
      let sessionId;
      const existingToken = req.cookies.sci_session_token;
      
      if (existingToken) {
          try {
              const decoded = jwt.verify(existingToken, process.env.JWT_SECRET);
              sessionId = decoded.session_id;
          } catch (e) {
              // Token เก่าใช้ไม่ได้ ให้สร้างใหม่
              sessionId = generateSecureSessionId();
          }
      } else {
          sessionId = generateSecureSessionId();
      }

      await initSessionRecord(sessionId);

      const expiresIn = 86400; // 24 hours
      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      // ✅ [Security Fix] Cookie Configuration
      res.cookie('sci_session_token', token, {
          httpOnly: true,    // ป้องกัน XSS (JavaScript อ่านไม่ได้)
          secure: true,      // บังคับ HTTPS เท่านั้น (หรือ localhost)
          sameSite: 'Strict',// ป้องกัน CSRF ได้ดีที่สุด (ส่งเฉพาะโดเมนเดียวกัน)
          maxAge: expiresIn * 1000
      });

      // ถ้า Frontend อยู่คนละ Domain กับ Backend (เช่น localhost:3000 vs 8080)
      // อาจต้องเปลี่ยน sameSite เป็น 'Lax' หรือ Config Proxy ให้ดีครับ 
      // แต่ระดับ "Highest Security" ควรเป็น 'Strict'

      res.json({ message: 'Session initialized', session_id: sessionId });

  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

function generateSecureSessionId() {
    return 'sess_' + crypto.randomBytes(16).toString('hex'); // 32 chars hex
}

module.exports = router;