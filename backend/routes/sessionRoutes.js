const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initSessionRecord } = require('../utils/dbUtils');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/init', strictLimiter, async (req, res) => {
  try {
      let sessionId;
      // ✅ 1. อ่านจากชื่อเดียว
      const existingToken = req.cookies.sci_session_token;
      
      if (existingToken) {
          try {
              const decoded = jwt.verify(existingToken, process.env.JWT_SECRET);
              sessionId = decoded.session_id;
          } catch (e) {
              sessionId = `sess_${uuidv4().split('-')[0]}`;
          }
      } else {
          sessionId = `sess_${uuidv4().split('-')[0]}`;
      }

      await initSessionRecord(sessionId);

      const expiresIn = 86400;
      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      res.cookie('sci_session_token', token, {
          httpOnly: true,
          secure: true,      
          sameSite: 'none',  
          maxAge: expiresIn * 1000
      });

      res.json({ message: 'Session initialized', session_id: sessionId });

  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;