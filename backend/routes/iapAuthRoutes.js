const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { ensureAppSession } = require('../utils/sessionUtils');

const router = express.Router();

function parseAllowedOrigins() {
  const rawOrigins =
    process.env.FRONTEND_URL ||
    'http://localhost:3000|http://localhost:5500|http://127.0.0.1:5500|http://localhost:5173';

  return rawOrigins
    .split(/[,|]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSafeReturnUrl(returnTo) {
  const allowedOrigins = parseAllowedOrigins();
  const preferredOrigin =
    allowedOrigins.find((origin) => origin.startsWith('https://')) ||
    allowedOrigins[0] ||
    null;

  if (!returnTo) {
    return preferredOrigin;
  }

  try {
    const parsed = new URL(returnTo);
    const normalizedOrigin = parsed.origin.replace(/\/$/, '');
    if (!allowedOrigins.includes(normalizedOrigin)) {
      return null;
    }
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

router.get('/complete', async (req, res) => {
  const requestedReturnTo = String(req.query.return_to || '').trim();
  const safeReturnUrl = getSafeReturnUrl(requestedReturnTo);

  if (!safeReturnUrl) {
    return res.status(400).json({
      error: 'Invalid return URL',
      message: 'return_to must match an allowed frontend origin.'
    });
  }

  try {
    await ensureAppSession(req, res);

    const redirectUrl = new URL(safeReturnUrl);
    redirectUrl.searchParams.set('auth', 'ok');

    return res.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error('IAP completion error:', error);
    return res.status(500).json({
      error: 'IAP completion failed',
      message: 'Unable to establish application session after IAP login.'
    });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  return res.json({
    authenticated: true,
    email: req.user?.iap?.email || null,
    hosted_domain: req.user?.iap?.hosted_domain || null
  });
});

module.exports = router;
