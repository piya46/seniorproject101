const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { initSessionRecord } = require('../utils/dbUtils'); // ✅ Import DB Utils

router.post('/init', async (req, res) => {
  try {
      const sessionId = `sess_${uuidv4().split('-')[0]}`; 
      const expiresIn = 1800;

      const token = jwt.sign({ session_id: sessionId }, process.env.JWT_SECRET, { expiresIn });

      
      await initSessionRecord(sessionId);

      res.json({
        session_token: token,
        expires_in: expiresIn,
        session_id: sessionId
      });
  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;