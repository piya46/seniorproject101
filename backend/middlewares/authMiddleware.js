const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { firestore, COLLECTION_NAME } = require('../utils/dbUtils'); // ✅ Import Firestore
const { extractDomain, getAllowedDomains, isHostedDomainRequired, isTruthy } = require('../utils/oidcUtils');

function isOidcEnabled() {
  return isTruthy(process.env.OIDC_ENABLED !== undefined ? process.env.OIDC_ENABLED : 'true');
}

function isTrustedBffAuthEnabled() {
  return isTruthy(process.env.TRUSTED_BFF_AUTH_ENABLED || 'false');
}

function getTrustedBffHeader(name) {
  return String(name || '').trim().toLowerCase();
}

function getTrustedBffSharedSecret(req) {
  const headerName = getTrustedBffHeader(process.env.TRUSTED_BFF_AUTH_HEADER_NAME || 'x-bff-auth');
  const headerValue = req.headers?.[headerName];

  if (typeof headerValue !== 'string') {
    return '';
  }

  return headerValue.trim();
}

function isValidSessionId(value) {
  return /^sess_[a-f0-9]{32}$/i.test(String(value || '').trim());
}

function getTrustedBffIdentity(req) {
  if (!isTrustedBffAuthEnabled()) {
    return null;
  }

  const sharedSecret = String(process.env.TRUSTED_BFF_SHARED_SECRET || '').trim();
  const providedSecret = getTrustedBffSharedSecret(req);
  if (!sharedSecret || !providedSecret) {
    return null;
  }

  const sharedSecretBuffer = Buffer.from(sharedSecret);
  const providedSecretBuffer = Buffer.from(providedSecret);

  if (
    sharedSecretBuffer.length !== providedSecretBuffer.length ||
    !crypto.timingSafeEqual(sharedSecretBuffer, providedSecretBuffer)
  ) {
    return null;
  }

  const sessionId = String(req.headers['x-bff-user-session-id'] || '').trim();
  const email = String(req.headers['x-bff-user-email'] || '').trim().toLowerCase();
  const hostedDomain = String(req.headers['x-bff-user-hosted-domain'] || '').trim().toLowerCase();

  if (!isValidSessionId(sessionId) || !email) {
    return null;
  }

  return {
    session_id: sessionId,
    email,
    hosted_domain: hostedDomain || null,
    auth_provider: 'trusted_bff',
    google_sub: String(req.headers['x-bff-user-google-sub'] || '').trim() || null,
    name: String(req.headers['x-bff-user-name'] || '').trim() || null,
    picture: String(req.headers['x-bff-user-picture'] || '').trim() || null
  };
}

module.exports = async (req, res, next) => { // ✅ เปลี่ยนเป็น async
  // 1. อ่าน Token จาก Cookie เป็นหลัก
  let token = req.cookies.sci_session_token;
  let trustedBffIdentity = null;

  // Bearer fallback is opt-in only. Default flow should stay cookie-based.
  if (
    !token &&
    isTruthy(process.env.ALLOW_BEARER_SESSION_TOKEN) &&
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
      token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    trustedBffIdentity = getTrustedBffIdentity(req);
    if (!trustedBffIdentity) {
      return res.status(401).json({ error: 'Unauthorized: No session token found' });
    }
  }

  try {
    // 2. Verify JWT Signature & Algorithm
    const decoded = trustedBffIdentity || jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256']
    });

    if (decoded.session_id) {
        const sessionRef = await firestore.collection(COLLECTION_NAME).doc(decoded.session_id).get();
        if (!sessionRef.exists) {
            console.warn(`⛔ Security: Revoked Session Attempt ${decoded.session_id}`);
            res.clearCookie('sci_session_token'); // สั่งลบ Cookie ที่เครื่องลูกข่าย
            return res.status(401).json({ error: 'Session Revoked', message: 'Your session has been terminated.' });
        }
    }
 
    req.user = decoded;

    if (isOidcEnabled()) {
      const email = String(decoded.email || '').trim().toLowerCase();
      const hostedDomain = String(decoded.hosted_domain || '').trim().toLowerCase() || null;
      const allowedDomains = getAllowedDomains();
      const emailDomain = extractDomain(email);

      if (!email) {
        return res.status(403).json({ error: 'Forbidden', message: 'OIDC-backed session is required.' });
      }

      if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Your Google account domain is not allowed.' });
      }

      if (isHostedDomainRequired() && allowedDomains.length > 0 && !allowedDomains.includes(hostedDomain)) {
        return res.status(403).json({ error: 'Forbidden', message: 'Your Google Workspace hosted domain is not allowed.' });
      }
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or Expired Token' });
  }
};
