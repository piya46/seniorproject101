const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

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