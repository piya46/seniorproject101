const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const trustedBffMiddleware = require('../middlewares/trustedBffMiddleware');
const { createTrustedBffMiddleware } = require('../middlewares/trustedBffMiddleware');
const { ensureAppSession, buildSessionCookieOptions } = require('../utils/sessionUtils');
const { revokeSessionRecord } = require('../utils/dbUtils');
const { clearCsrfCookie, ensureCsrfCookie } = require('../utils/csrfUtils');
const {
  buildGoogleLoginUrl,
  exchangeCodeForTokens,
  normalizeGoogleIdentity,
  verifyGoogleIdToken,
  verifyStateToken
} = require('../utils/oidcUtils');
const { isAllowedBrowserOrigin } = require('../utils/browserOrigin');

const router = express.Router();
const trustedBffAttestationOnlyMiddleware = createTrustedBffMiddleware({ requireIdentityHeaders: false });

function isOidcEnabled() {
  return String(process.env.OIDC_ENABLED || 'true').toLowerCase() === 'true';
}

function isPrivateBackendMode() {
  return String(process.env.CLOUD_RUN_AUTH_MODE || 'public').toLowerCase() === 'private';
}

function rejectLegacyDirectOidcFlow(req, res) {
  req.log?.warn('legacy_direct_oidc_flow_blocked', {
    cloud_run_auth_mode: process.env.CLOUD_RUN_AUTH_MODE || 'public'
  });
  return res.status(409).json({
    error: 'Legacy browser OIDC flow disabled',
    message: 'This backend is running in private BFF mode. Start login from the frontend BFF instead.'
  });
}

function buildBffCallbackUrl(returnTo) {
  const returnUrl = new URL(returnTo);
  return `${returnUrl.origin}/auth/callback`;
}

router.get('/google/login', (req, res) => {
  if (!isOidcEnabled()) {
    return res.status(503).json({
      error: 'OIDC Disabled',
      message: 'Google OIDC login is disabled on this server.'
    });
  }

  if (isPrivateBackendMode()) {
    return rejectLegacyDirectOidcFlow(req, res);
  }

  try {
    const loginUrl = buildGoogleLoginUrl(req, String(req.query.return_to || '').trim());
    req.log?.audit('oidc_login_redirect_started');
    return res.redirect(302, loginUrl);
  } catch (error) {
    req.log?.warn('oidc_login_redirect_rejected', { message: error.message });
    return res.status(400).json({
      error: 'Invalid login request',
      message: error.message
    });
  }
});

router.get('/bff/google/login-url', trustedBffAttestationOnlyMiddleware, (req, res) => {
  if (!isOidcEnabled()) {
    return res.status(503).json({
      error: 'OIDC Disabled',
      message: 'Google OIDC login is disabled on this server.'
    });
  }

  try {
    const returnTo = String(req.query.return_to || '').trim();
    const loginUrl = buildGoogleLoginUrl(req, returnTo, {
      callbackUrl: buildBffCallbackUrl(returnTo)
    });

    req.log?.audit('bff_oidc_login_url_issued');
    return res.json({
      login_url: loginUrl
    });
  } catch (error) {
    req.log?.warn('bff_oidc_login_url_rejected', { message: error.message });
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

  if (isPrivateBackendMode()) {
    return rejectLegacyDirectOidcFlow(req, res);
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
    ensureCsrfCookie(req, res);
    req.log?.audit('oidc_login_completed', {
      user_email: identity.email || null,
      hosted_domain: identity.hosted_domain || null
    });

    const redirectUrl = new URL(decodedState.return_to);
    redirectUrl.searchParams.set('auth', 'ok');
    redirectUrl.searchParams.set('oidc', 'done');

    return res.redirect(302, redirectUrl.toString());
  } catch (error) {
    req.log?.error('oidc_callback_error', { message: error.message });
    return res.status(401).json({
      error: 'OIDC authentication failed',
      message: error.message
    });
  }
});

router.get('/bff/google/callback', trustedBffAttestationOnlyMiddleware, async (req, res) => {
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
    const callbackUrl = buildBffCallbackUrl(decodedState.return_to);
    const tokenResponse = await exchangeCodeForTokens(req, code, { callbackUrl });
    const idToken = String(tokenResponse.id_token || '').trim();

    if (!idToken) {
      throw new Error('Missing id_token in Google token response.');
    }

    const payload = await verifyGoogleIdToken(req, idToken, decodedState.nonce);
    const identity = normalizeGoogleIdentity(payload);

    await ensureAppSession(req, res, identity);
    ensureCsrfCookie(req, res);
    req.log?.audit('bff_oidc_login_completed', {
      user_email: identity.email || null,
      hosted_domain: identity.hosted_domain || null
    });

    return res.json({
      status: 'success',
      return_to: decodedState.return_to,
      authenticated: true,
      email: identity.email || null,
      hosted_domain: identity.hosted_domain || null,
      name: identity.name || null,
      picture: identity.picture || null,
      auth_provider: identity.auth_provider || null
    });
  } catch (error) {
    req.log?.error('bff_oidc_callback_error', { message: error.message });
    return res.status(401).json({
      error: 'OIDC authentication failed',
      message: error.message
    });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  ensureCsrfCookie(req, res);
  return res.json({
    authenticated: true,
    email: req.user?.email || null,
    hosted_domain: req.user?.hosted_domain || null,
    name: req.user?.name || null,
    picture: req.user?.picture || null,
    auth_provider: req.user?.auth_provider || null
  });
});

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (!isAllowedBrowserOrigin(req, { requireHeader: true })) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Origin is not allowed for logout requests.'
      });
    }

    const sessionId = String(req.user?.session_id || '').trim();
    if (sessionId) {
      try {
        await revokeSessionRecord(sessionId);
        req.log?.audit('oidc_logout_completed', { session_id: sessionId });
      } catch (error) {
        req.log?.warn('oidc_logout_revoke_skipped', { message: error.message });
      }
    }

    res.clearCookie('sci_session_token', {
      ...buildSessionCookieOptions(),
      maxAge: undefined,
      expires: new Date(0)
    });
    clearCsrfCookie(res);
    res.set('Clear-Site-Data', '"cache", "cookies", "storage"');

    return res.json({
      status: 'success',
      message: 'Logged out successfully.'
    });
  } catch (error) {
    req.log?.error('oidc_logout_error', { message: error.message });
    return res.status(500).json({
      error: 'Logout failed',
      message: 'Failed to revoke the active session.'
    });
  }
});

module.exports = router;
