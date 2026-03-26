const express = require('express');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middlewares/authMiddleware');
const { ensureAppSession, buildSessionCookieOptions } = require('../utils/sessionUtils');
const { revokeSessionRecord } = require('../utils/dbUtils');
const {
  buildGoogleLoginUrl,
  exchangeCodeForTokens,
  normalizeGoogleIdentity,
  verifyGoogleIdToken,
  verifyStateToken
} = require('../utils/oidcUtils');

const router = express.Router();

function isOidcEnabled() {
  return String(process.env.OIDC_ENABLED || 'true').toLowerCase() === 'true';
}

router.get('/google/login', (req, res) => {
  if (!isOidcEnabled()) {
    return res.status(503).json({
      error: 'OIDC Disabled',
      message: 'Google OIDC login is disabled on this server.'
    });
  }

  try {
    const loginUrl = buildGoogleLoginUrl(req, String(req.query.return_to || '').trim());
    return res.redirect(302, loginUrl);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid login request',
      message: error.message
    });
  }
});

router.get('/google/callback', async (req, res) => {
  if (!isOidcEnabled()) {
    return res.status(503).json({
      error: 'OIDC Disabled',
      message: 'Google OIDC login is disabled on this server.'
    });
  }

  const code = String(req.query.code || '').trim();
  const state = String(req.query.state || '').trim();

  if (!code || !state) {
    return res.status(400).json({
      error: 'Invalid callback request',
      message: 'Missing authorization code or state.'
    });
  }

  try {
    const decodedState = verifyStateToken(state);
    const tokenResponse = await exchangeCodeForTokens(req, code);
    const idToken = String(tokenResponse.id_token || '').trim();

    if (!idToken) {
      throw new Error('Missing id_token in Google token response.');
    }

    const payload = await verifyGoogleIdToken(req, idToken, decodedState.nonce);
    const identity = normalizeGoogleIdentity(payload);

    await ensureAppSession(req, res, identity);

    const redirectUrl = new URL(decodedState.return_to);
    redirectUrl.searchParams.set('auth', 'ok');
    redirectUrl.searchParams.set('oidc', 'done');

    return res.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error('OIDC callback error:', error);
    return res.status(401).json({
      error: 'OIDC authentication failed',
      message: error.message
    });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  return res.json({
    authenticated: true,
    email: req.user?.email || null,
    hosted_domain: req.user?.hosted_domain || null,
    name: req.user?.name || null,
    picture: req.user?.picture || null,
    auth_provider: req.user?.auth_provider || null
  });
});

router.post('/logout', async (req, res) => {
  try {
    if (req.cookies?.sci_session_token) {
      try {
        const decoded = jwt.verify(req.cookies.sci_session_token, process.env.JWT_SECRET, {
          algorithms: ['HS256']
        });
        await revokeSessionRecord(decoded.session_id);
      } catch (error) {
        console.warn('OIDC logout revoke skipped:', error.message);
      }
    }

    res.clearCookie('sci_session_token', {
      ...buildSessionCookieOptions(),
      maxAge: undefined,
      expires: new Date(0)
    });

    return res.json({
      status: 'success',
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('OIDC logout error:', error);
    return res.status(500).json({
      error: 'Logout failed',
      message: 'Failed to revoke the active session.'
    });
  }
});

module.exports = router;
