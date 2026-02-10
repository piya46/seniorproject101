const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { initSessionRecord } = require('../utils/dbUtils');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { sessionInitSchema } = require('../validators/schemas');

router.post('/init', strictLimiter, validate(sessionInitSchema), async (req, res) => {
  try {
      let sessionId;
      const existingToken = req.cookies.sci_session_token;
      
      if (existingToken) {
          try {
              const decoded = jwt.verify(existingToken, process.env.JWT_SECRET);
              sessionId = decoded.session_id;
          } catch (e) {
              sessionId = generateSecureSessionId();
          }
      } else {
          sessionId = generateSecureSessionId();
      }

      await initSessionRecord(sessionId);

      const expiresIn = 86400; // 24 hours
      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      // ✅ SECURITY UPGRADE: Robust Cookie Configuration
      const isProduction = process.env.NODE_ENV === 'production';
      
      res.cookie('sci_session_token', token, {
          httpOnly: true, // ห้าม JavaScript ฝั่ง Client เข้าถึง
          secure: isProduction, // บังคับ HTTPS เฉพาะ Production (จะได้ test local ง่าย)
          sameSite: isProduction ? 'Strict' : 'Lax', // Production ต้อง Strict เท่านั้น
          maxAge: expiresIn * 1000
      });

      res.json({ message: 'Session initialized', session_id: sessionId });

  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

function generateSecureSessionId() {
    return 'sess_' + crypto.randomBytes(16).toString('hex');
}

module.exports = router;