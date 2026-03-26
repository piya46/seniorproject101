const express = require('express');
const router = express.Router();
const { strictLimiter } = require('../middlewares/rateLimitMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { sessionInitSchema } = require('../validators/schemas');
const { ensureAppSession } = require('../utils/sessionUtils');

router.post('/init', authMiddleware, strictLimiter, validate(sessionInitSchema), async (req, res) => {
  try {
      const { sessionId, csrfToken } = await ensureAppSession(req, res);
      req.log?.audit('session_initialized', { session_id: sessionId });
      res.json({ message: 'Session initialized', session_id: sessionId, csrf_token: csrfToken });
  } catch (error) {
      req.log?.error('session_init_error', { message: error.message });
      res.status(500).json({ error: 'Failed to initialize session' });
  }
});

module.exports = router;
