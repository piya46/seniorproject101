const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initSessionRecord } = require('../utils/dbUtils');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/init', strictLimiter, async (req, res) => {
  try {
      let sessionId;
      // ✅ 1. อ่าน Token จาก Cookie ชื่อ 'sci_session_token'
      const existingToken = req.cookies.sci_session_token;
      
      if (existingToken) {
          try {
              const decoded = jwt.verify(existingToken, process.env.JWT_SECRET);
              sessionId = decoded.session_id;
              console.log(`♻️ Resuming session: ${sessionId}`);
          } catch (e) {
              sessionId = `sess_${uuidv4().split('-')[0]}`;
          }
      } else {
          sessionId = `sess_${uuidv4().split('-')[0]}`;
      }

      // 🔥 สำคัญ: บันทึก Session เริ่มต้นลง Firestore
      await initSessionRecord(sessionId);

      const expiresIn = 86400; // 24 ชั่วโมง
      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      // ✅ 2. ตั้งชื่อ Cookie ว่า 'sci_session_token' ให้ตรงกับ Auth Middleware และ Frontend
      res.cookie('sci_session_token', token, {
          httpOnly: true,
          secure: true,      
          sameSite: 'none',  
          maxAge: expiresIn * 1000
      });

      res.json({
        message: 'Session initialized',
        session_id: sessionId
      });

  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;