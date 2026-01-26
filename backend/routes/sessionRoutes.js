const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initSessionRecord } = require('../utils/dbUtils');
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/init', strictLimiter, async (req, res) => {
  try {
      let sessionId;
      // ✅ 1. ลองอ่าน Token จาก Cookie ที่ส่งมา
      const existingToken = req.cookies.session_token;
      
      if (existingToken) {
          try {
              // ตรวจสอบว่า Token เก่ายังไม่หมดอายุ และใช้ได้
              const decoded = jwt.verify(existingToken, process.env.JWT_SECRET);
              sessionId = decoded.session_id;
              console.log(`♻️ Resuming session: ${sessionId}`);
          } catch (e) {
              // ถ้า Token หมดอายุ หรือใช้ไม่ได้ ให้สร้างใหม่
              sessionId = `sess_${uuidv4().split('-')[0]}`;
          }
      } else {
          // ถ้าไม่มี Cookie เลย ให้สร้างใหม่
          sessionId = `sess_${uuidv4().split('-')[0]}`;
      }

      // ตั้งเวลาหมดอายุ 24 ชั่วโมง
      const expiresIn = 86400; 
      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      // บันทึกลง Firestore (ถ้ามีแล้วจะเป็นการ update last_active)
      await initSessionRecord(sessionId);

      // ✅ 2. ตั้งค่า Cookie แบบ Production-Ready
      res.cookie('session_token', token, {
          httpOnly: true,    // 🛡️ ป้องกัน JavaScript อ่าน (กัน XSS)
          
          // 🔒 บังคับ Secure=true เสมอ (Cloud Run เป็น HTTPS)
          secure: true,      
          
          // 🌍 อนุญาตให้ส่งข้ามโดเมน (จำเป็นเพราะ Frontend กับ Backend อยู่คนละที่)
          // ถ้าตั้งเป็น 'strict' ระบบจะพังทันทีถ้าโดเมนไม่ตรงกันเป๊ะๆ
          sameSite: 'none',  
          
          maxAge: expiresIn * 1000 // 24 ชม.
      });

      res.json({
        message: 'Session initialized',
        session_id: sessionId,
        // user_data: ... (ถ้ามีข้อมูลอื่นอยากส่งกลับ)
      });

  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;