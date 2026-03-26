const express = require('express');
const router = express.Router();
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { sessionInitSchema } = require('../validators/schemas');
const { ensureAppSession } = require('../utils/sessionUtils');

router.post('/init', authMiddleware, strictLimiter, validate(sessionInitSchema), async (req, res) => {
  try {
      const { sessionId } = await ensureAppSession(req, res);
      res.json({ message: 'Session initialized', session_id: sessionId });
  } catch (error) {
      console.error('Session Init Error:', error);
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;
